'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { ArrowLeft, Copy, Download, Palette, Plus, Save, Send, Trash2 } from 'lucide-react';

import { RichTextEditor } from '@/components/RichTextEditor';
import { PageHeader } from '@/layouts';
import { apiClient } from '@/lib/api';
import { buildCampaignCalendarEventFromEventData, buildCampaignDefaultCopy } from '@/lib/formCampaignCalendar';
import { sendFormCampaign } from '@/lib/formCampaigns';
import {
  ACCEPTED_EMAIL_IMAGE_TYPES,
  DEFAULT_EMAIL_ACCENT_COLOR,
  DEFAULT_EMAIL_SURFACE_COLOR,
  MAX_EMAIL_IMAGE_BYTES,
  MAX_EMAIL_IMAGE_MB,
  buildFormEmailHTML,
  buildFormEmailTextBody,
  embedTemplateMeta,
  escapeTemplateHtml,
  normalizeAbsoluteHttpUrl,
  normalizeTemplateSlug,
  parseTemplateMeta,
  stripTemplateMeta,
  toEmailPreview,
  type FormEmailCalendarEvent,
  type FormEmailResourceLink,
  type StoredFormEmailTemplateMeta,
} from '@/lib/formEmailTemplates';
import {
  exportFormCampaignRecipientsCsv,
  extractFormCampaignRecipients,
  fetchAllFormSubmissions,
  resolveFormSubmissionEmail,
  type FormCampaignRecipient,
} from '@/lib/formSubmissions';
import { getServerErrorMessage } from '@/lib/serverValidation';
import type { AdminForm, EmailTemplate, EventData, FormSubmission, UpdateFormRequest } from '@/lib/types';
import { buildPublicFormUrl } from '@/lib/utils';
import { withAuth } from '@/providers/withAuth';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Input } from '@/ui/input';

type AudienceStats = {
  totalSubmissions: number;
  submissionsWithValidEmail: number;
  uniqueRecipients: number;
  duplicateEmails: number;
  missingOrInvalidEmail: number;
};

type PersistedCampaign = {
  updatedForm: AdminForm;
  savedTemplate: EmailTemplate;
  htmlBody: string;
  textBody: string;
  calendarUrl?: string;
  calendarEvent?: FormEmailCalendarEvent;
  resourceLinks?: FormEmailResourceLink[];
  heroImageUrl?: string;
  ctaUrl?: string;
};

const DEFAULT_MESSAGE_HTML = [
  '<p>Thank you for registering. We are sharing this update so you have the latest details, announcements, and event resources before the day.</p>',
  '<p>Please review the information below and keep this email for quick reference.</p>',
].join('');

const DEFAULT_PREHEADER = 'Important event update for registered guests. Open this email and save the date in your calendar.';
const DEFAULT_CALENDAR_LABEL = 'Add event to calendar';

type CampaignCalendarDraft = {
  title: string;
  startAt: string;
  endAt: string;
  location: string;
  description: string;
  timeZone: string;
};

type CampaignResourceDraft = {
  label: string;
  url: string;
  description: string;
  kind: string;
};

function createEmptyResourceDraft(): CampaignResourceDraft {
  return {
    label: '',
    url: '',
    description: '',
    kind: 'flyer',
  };
}

function buildAudienceStats(
  submissions: FormSubmission[],
  recipients: FormCampaignRecipient[]
): AudienceStats {
  const submissionsWithValidEmail = submissions.filter((submission) => {
    const email = resolveFormSubmissionEmail(submission);
    return Boolean(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  }).length;

  return {
    totalSubmissions: submissions.length,
    submissionsWithValidEmail,
    uniqueRecipients: recipients.length,
    duplicateEmails: Math.max(0, submissionsWithValidEmail - recipients.length),
    missingOrInvalidEmail: Math.max(0, submissions.length - submissionsWithValidEmail),
  };
}

function validateImageFile(file: File): string | null {
  if (!ACCEPTED_EMAIL_IMAGE_TYPES.includes(file.type)) {
    return 'Image must be JPEG, PNG, or WebP.';
  }
  if (file.size > MAX_EMAIL_IMAGE_BYTES) {
    return `Image must be ${MAX_EMAIL_IMAGE_MB}MB or smaller.`;
  }
  return null;
}

function toRichTextHtml(value: string) {
  const segments = value
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (segments.length === 0) {
    return DEFAULT_MESSAGE_HTML;
  }

  return segments.map((segment) => `<p>${escapeTemplateHtml(segment).replace(/\n/g, '<br />')}</p>`).join('');
}

function toPlainText(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h1|h2|h3|blockquote|ul|ol)>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function toDateTimeLocalValue(value?: string) {
  if (!value?.trim()) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';

  const localTime = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000);
  return localTime.toISOString().slice(0, 16);
}

function normalizeCampaignCalendarDraft(
  draft: CampaignCalendarDraft
): { event?: FormEmailCalendarEvent; error?: string } {
  const title = draft.title.trim();
  const location = draft.location.trim();
  const description = draft.description.trim();
  const timeZone = draft.timeZone.trim();
  const startAtRaw = draft.startAt.trim();
  const endAtRaw = draft.endAt.trim();
  const hasAnyValue = [title, location, description, timeZone, startAtRaw, endAtRaw].some(Boolean);

  if (!hasAnyValue) return {};
  if (!title) {
    return { error: 'Calendar event title is required once you add calendar details.' };
  }
  if (!startAtRaw) {
    return { error: 'Calendar start time is required once you add calendar details.' };
  }

  const startAt = new Date(startAtRaw);
  if (Number.isNaN(startAt.getTime())) {
    return { error: 'Calendar start time is invalid.' };
  }

  let endAt: Date | undefined;
  if (endAtRaw) {
    endAt = new Date(endAtRaw);
    if (Number.isNaN(endAt.getTime())) {
      return { error: 'Calendar end time is invalid.' };
    }
    if (endAt.getTime() <= startAt.getTime()) {
      return { error: 'Calendar end time must be after the start time.' };
    }
  }

  return {
    event: {
      title,
      startAt: startAt.toISOString(),
      endAt: endAt ? endAt.toISOString() : undefined,
      location: location || undefined,
      description: description || undefined,
      timeZone: timeZone || undefined,
    },
  };
}

function normalizeCampaignResourceDrafts(
  drafts: CampaignResourceDraft[]
): { resourceLinks: FormEmailResourceLink[]; error?: string } {
  const resourceLinks: FormEmailResourceLink[] = [];

  for (let index = 0; index < drafts.length; index += 1) {
    const draft = drafts[index];
    const label = draft.label.trim();
    const url = draft.url.trim();
    const description = draft.description.trim();
    const kind = draft.kind.trim().toLowerCase() || 'resource';
    const hasAnyValue = [label, url, description].some(Boolean);

    if (!hasAnyValue) {
      continue;
    }
    if (!label) {
      return { resourceLinks: [], error: `Resource ${index + 1} needs a label.` };
    }
    if (!url) {
      return { resourceLinks: [], error: `Resource ${index + 1} needs a URL.` };
    }
    if (label.length > 80) {
      return { resourceLinks: [], error: `Resource ${index + 1} label must be 80 characters or fewer.` };
    }
    if (description.length > 200) {
      return { resourceLinks: [], error: `Resource ${index + 1} description must be 200 characters or fewer.` };
    }

    const normalizedUrl = normalizeAbsoluteHttpUrl(url);
    if (!normalizedUrl) {
      return { resourceLinks: [], error: `Resource ${index + 1} URL is invalid. Use a full URL like https://...` };
    }

    resourceLinks.push({
      label,
      url: normalizedUrl,
      description: description || undefined,
      kind,
    });
  }

  return { resourceLinks };
}

function appendCampaignTextFallback(
  value: string,
  opts: {
    calendarLabel?: string;
    includeCalendarOptIn?: boolean;
    includeRegistrationCode?: boolean;
    resourceLinks?: FormEmailResourceLink[];
  }
) {
  let output = value.trim();

  if (opts.resourceLinks?.length) {
    const resourceLines = opts.resourceLinks.flatMap((resource) => {
      const label = resource.label?.trim();
      const url = resource.url?.trim();
      if (!label || !url) return [];
      const description = resource.description?.trim();
      return [
        `${label}: ${url}`,
        ...(description ? [description] : []),
      ];
    });

    if (resourceLines.length > 0) {
      output = `${output}\n\nEvent resources:\n${resourceLines.join('\n')}`.trim();
    }
  }

  if (opts.includeCalendarOptIn && !output.includes('{{.CalendarOptInURL}}')) {
    output = `${output}\n\nCalendar reminder: open your calendar now and save the event.\n${opts.calendarLabel || 'Add event to calendar'}: {{.CalendarOptInURL}}`.trim();
  }

  if (opts.includeRegistrationCode && !output.includes('{{.RegistrationCode}}')) {
    output = `${output}\n\nRegistration Number: {{.RegistrationCode}}`.trim();
  }

  return output;
}

function RegistrantCampaignPage() {
  const params = useParams();
  const router = useRouter();
  const formId = useMemo(() => {
    const raw = params?.id;
    return typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : '';
  }, [params]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  const [form, setForm] = useState<AdminForm | null>(null);
  const [template, setTemplate] = useState<EmailTemplate | null>(null);
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);

  const [subject, setSubject] = useState('');
  const [preheader, setPreheader] = useState(DEFAULT_PREHEADER);
  const [eyebrow, setEyebrow] = useState('Campaign Update');
  const [heading, setHeading] = useState('A special update for our registered guests');
  const [messageHtml, setMessageHtml] = useState(DEFAULT_MESSAGE_HTML);
  const [spotlightLabel, setSpotlightLabel] = useState('');
  const [spotlightText, setSpotlightText] = useState('');
  const [footerNote, setFooterNote] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [ctaLabel, setCtaLabel] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');
  const [calendarLabel, setCalendarLabel] = useState(DEFAULT_CALENDAR_LABEL);
  const [calendarUrl, setCalendarUrl] = useState('');
  const [calendarTitle, setCalendarTitle] = useState('');
  const [calendarStartAt, setCalendarStartAt] = useState('');
  const [calendarEndAt, setCalendarEndAt] = useState('');
  const [calendarLocation, setCalendarLocation] = useState('');
  const [calendarDescription, setCalendarDescription] = useState('');
  const [calendarTimeZone, setCalendarTimeZone] = useState('');
  const [resourceLinks, setResourceLinks] = useState<CampaignResourceDraft[]>([]);
  const [accentColor, setAccentColor] = useState(DEFAULT_EMAIL_ACCENT_COLOR);
  const [surfaceColor, setSurfaceColor] = useState(DEFAULT_EMAIL_SURFACE_COLOR);

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [customHtmlBody, setCustomHtmlBody] = useState('');
  const [recipientQuery, setRecipientQuery] = useState('');
  const [selectionCount, setSelectionCount] = useState('');
  const [selectionInitialized, setSelectionInitialized] = useState(false);

  const recipients = useMemo(() => extractFormCampaignRecipients(submissions), [submissions]);
  const audienceStats = useMemo(() => buildAudienceStats(submissions, recipients), [submissions, recipients]);
  const messageText = useMemo(() => toPlainText(messageHtml), [messageHtml]);
  const normalizedCalendar = useMemo(
    () =>
      normalizeCampaignCalendarDraft({
        title: calendarTitle,
        startAt: calendarStartAt,
        endAt: calendarEndAt,
        location: calendarLocation,
        description: calendarDescription,
        timeZone: calendarTimeZone,
      }),
    [calendarDescription, calendarEndAt, calendarLocation, calendarStartAt, calendarTimeZone, calendarTitle]
  );
  const normalizedResources = useMemo(() => normalizeCampaignResourceDrafts(resourceLinks), [resourceLinks]);
  const filteredRecipients = useMemo(() => {
    const term = recipientQuery.trim().toLowerCase();
    if (!term) return recipients;

    return recipients.filter((recipient) =>
      [recipient.name, recipient.email, recipient.registrationCode, new Date(recipient.submittedAt).toLocaleString()]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [recipientQuery, recipients]);
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);
  const selectedRecipientIdSet = useMemo(() => new Set(selectedRecipientIds), [selectedRecipientIds]);
  const selectedRecipients = useMemo(
    () => recipients.filter((recipient) => selectedRecipientIdSet.has(recipient.submissionId)),
    [recipients, selectedRecipientIdSet]
  );
  const selectedFilteredRecipientsCount = useMemo(
    () => filteredRecipients.filter((recipient) => selectedRecipientIdSet.has(recipient.submissionId)).length,
    [filteredRecipients, selectedRecipientIdSet]
  );

  const templateKeyPreview = useMemo(() => {
    const existing = form?.settings?.campaignEmailTemplateKey?.trim();
    if (existing) return existing;
    if (form?.slug) return `forms/${form.slug}/campaigns/primary`;
    if (form?.title) return `forms/${normalizeTemplateSlug(form.title)}/campaigns/primary`;
    if (form?.id) return `forms/${form.id}/campaigns/primary`;
    return '';
  }, [form]);

  const generatedHtml = useMemo(
    () =>
      buildFormEmailHTML({
        title: form?.title || 'Registrant Outreach',
        preheader: preheader.trim() || undefined,
        eyebrow,
        heading,
        message: messageText,
        messageHtml,
        logoUrl: logoPreview || logoUrl || undefined,
        imageUrl: imagePreview || imageUrl || undefined,
        ctaLabel: ctaLabel.trim() || undefined,
        ctaUrl: ctaUrl.trim() || undefined,
        resourceLinks: normalizedResources.resourceLinks,
        includeRegistrationCode: true,
        includeCalendarOptIn: Boolean(calendarUrl.trim() || normalizedCalendar.event),
        calendarLabel: calendarLabel.trim() || undefined,
        calendarEvent: normalizedCalendar.event,
        greeting: 'Hello {{.RecipientName}},',
        spotlightLabel: spotlightLabel.trim() || undefined,
        spotlightText: spotlightText.trim() || undefined,
        accentColor,
        surfaceColor,
        footerNote: footerNote.trim() || undefined,
      }),
    [
      accentColor,
      calendarLabel,
      calendarUrl,
      normalizedCalendar.event,
      ctaLabel,
      ctaUrl,
      eyebrow,
      footerNote,
      form?.title,
      heading,
      imagePreview,
      imageUrl,
      logoPreview,
      logoUrl,
      messageHtml,
      messageText,
      preheader,
      spotlightLabel,
      spotlightText,
      surfaceColor,
      normalizedResources.resourceLinks,
    ]
  );

  const generatedText = useMemo(
    () =>
      buildFormEmailTextBody({
        title: form?.title || 'Registrant Outreach',
        preheader: preheader.trim() || undefined,
        eyebrow,
        heading,
        message: messageText,
        messageHtml,
        ctaLabel: ctaLabel.trim() || undefined,
        ctaUrl: ctaUrl.trim() || undefined,
        resourceLinks: normalizedResources.resourceLinks,
        calendarLabel: calendarLabel.trim() || undefined,
        calendarUrl: normalizeAbsoluteHttpUrl(calendarUrl) || undefined,
        calendarEvent: normalizedCalendar.event,
        includeCalendarOptIn: Boolean(calendarUrl.trim() || normalizedCalendar.event),
        spotlightLabel: spotlightLabel.trim() || undefined,
        spotlightText: spotlightText.trim() || undefined,
        footerNote: footerNote.trim() || undefined,
      }),
    [
      preheader,
      calendarLabel,
      calendarUrl,
      normalizedCalendar.event,
      ctaLabel,
      ctaUrl,
      eyebrow,
      footerNote,
      form?.title,
      heading,
      messageHtml,
      messageText,
      spotlightLabel,
      spotlightText,
      normalizedResources.resourceLinks,
    ]
  );

  const activeHtmlBody = useMemo(() => customHtmlBody.trim() || generatedHtml, [customHtmlBody, generatedHtml]);
  const activeTextBody = useMemo(
    () =>
      customHtmlBody.trim()
        ? appendCampaignTextFallback(toPlainText(customHtmlBody), {
            calendarLabel: calendarLabel.trim() || undefined,
            includeCalendarOptIn: Boolean(calendarUrl.trim() || normalizedCalendar.event),
            includeRegistrationCode: true,
            resourceLinks: normalizedResources.resourceLinks,
          })
        : generatedText,
    [calendarLabel, calendarUrl, customHtmlBody, generatedText, normalizedCalendar.event, normalizedResources.resourceLinks]
  );
  const previewHTML = useMemo(() => toEmailPreview(activeHtmlBody), [activeHtmlBody]);

  const campaignHtmlFilename = useMemo(() => {
    const label = form?.slug || form?.title || form?.id || 'registrant-outreach';
    return `${normalizeTemplateSlug(label)}-campaign.html`;
  }, [form?.id, form?.slug, form?.title]);

  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [logoPreview, imagePreview]);

  useEffect(() => {
    const detectedTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!detectedTimeZone) return;
    setCalendarTimeZone((current) => current || detectedTimeZone);
  }, []);

  useEffect(() => {
    if (!formId) return;
    setLoading(true);
    setForm(null);
    setTemplate(null);
    setSubmissions([]);
    setSelectionInitialized(false);
    setSelectedRecipientIds([]);
    setRecipientQuery('');
    setSelectionCount('');

    (async () => {
      try {
        const loadedForm = await apiClient.getAdminForm(formId);
        const [allSubmissions, templatesResponse, loadedEvent] = await Promise.all([
          fetchAllFormSubmissions(formId),
          apiClient.listAdminEmailTemplates({
            page: 1,
            limit: 50,
            ownerType: 'form_campaign',
            ownerId: formId,
          }),
          loadedForm.eventId ? apiClient.getAdminEvent(loadedForm.eventId).catch(() => null) : Promise.resolve(null),
        ]);
        const smartDefaults = buildCampaignDefaultCopy(loadedForm.title, loadedEvent as EventData | null);
        const fallbackCalendarEvent = buildCampaignCalendarEventFromEventData(
          loadedEvent as EventData | null,
          Intl.DateTimeFormat().resolvedOptions().timeZone || undefined
        );

        setForm(loadedForm);
        setSubmissions(allSubmissions);

        const subjectFallback =
          loadedForm.settings?.campaignEmailSubject?.trim() || smartDefaults.subject;
        setSubject(subjectFallback);
        setPreheader(smartDefaults.preheader);
        setHeading(smartDefaults.heading);
        setImageUrl(
          loadedForm.settings?.campaignEmailTemplateUrl?.trim() ||
            loadedEvent?.bannerImage?.trim() ||
            loadedEvent?.image?.trim() ||
            ''
        );
        setCtaUrl(
          loadedEvent?.registerLink?.trim() ||
            buildPublicFormUrl(loadedForm.slug, loadedForm.publicUrl) ||
            ''
        );
        setCtaLabel((current) => current || (loadedEvent?.registerLink ? 'View event details' : 'Open registration page'));
        if (fallbackCalendarEvent) {
          setCalendarTitle(fallbackCalendarEvent.title);
          setCalendarStartAt(toDateTimeLocalValue(fallbackCalendarEvent.startAt));
          setCalendarEndAt(toDateTimeLocalValue(fallbackCalendarEvent.endAt));
          setCalendarLocation(fallbackCalendarEvent.location || '');
          setCalendarDescription(fallbackCalendarEvent.description || '');
          setCalendarTimeZone((current) => current || fallbackCalendarEvent.timeZone || '');
        } else {
          setCalendarTitle((current) => current || loadedForm.title || '');
        }
        setResourceLinks([]);

        const active = templatesResponse.data.find((item) => item.isActive);
        const latest = [...templatesResponse.data].sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1))[0];
        const tpl = active || latest || null;

        if (tpl) {
          setTemplate(tpl);
          if (tpl.subject?.trim()) setSubject(tpl.subject.trim());

          const meta = parseTemplateMeta(tpl.htmlBody);
          if (meta?.preheader) setPreheader(meta.preheader);
          if (meta?.eyebrow) setEyebrow(meta.eyebrow);
          if (meta?.heading) setHeading(meta.heading);
          if (meta?.messageHtml?.trim()) setMessageHtml(meta.messageHtml.trim());
          else if (meta?.message?.trim()) setMessageHtml(toRichTextHtml(meta.message));
          if (meta?.logoUrl) setLogoUrl(meta.logoUrl);
          if (meta?.imageUrl) setImageUrl(meta.imageUrl);
          if (meta?.ctaLabel) setCtaLabel(meta.ctaLabel);
          if (meta?.ctaUrl) setCtaUrl(meta.ctaUrl);
          if (meta?.calendarLabel) setCalendarLabel(meta.calendarLabel);
          if (meta?.calendarUrl) setCalendarUrl(meta.calendarUrl);
          if (meta?.calendarEvent) {
            if (meta.calendarEvent.title?.trim()) setCalendarTitle(meta.calendarEvent.title.trim());
            if (meta.calendarEvent.startAt) setCalendarStartAt(toDateTimeLocalValue(meta.calendarEvent.startAt));
            if (meta.calendarEvent.endAt) setCalendarEndAt(toDateTimeLocalValue(meta.calendarEvent.endAt));
            if (meta.calendarEvent.location) setCalendarLocation(meta.calendarEvent.location);
            if (meta.calendarEvent.description) setCalendarDescription(meta.calendarEvent.description);
            if (meta.calendarEvent.timeZone?.trim()) setCalendarTimeZone(meta.calendarEvent.timeZone.trim());
          }
          if (meta?.resourceLinks?.length) {
            setResourceLinks(
              meta.resourceLinks.map((resource) => ({
                label: resource.label || '',
                url: resource.url || '',
                description: resource.description || '',
                kind: resource.kind || 'resource',
              }))
            );
          }
          if (meta?.spotlightLabel) setSpotlightLabel(meta.spotlightLabel);
          if (meta?.spotlightText) setSpotlightText(meta.spotlightText);
          if (meta?.accentColor) setAccentColor(meta.accentColor);
          if (meta?.surfaceColor) setSurfaceColor(meta.surfaceColor);
          if (meta?.footerNote) setFooterNote(meta.footerNote);
          if (meta?.customHtml) setCustomHtmlBody(stripTemplateMeta(meta.customHtml));
          else setCustomHtmlBody('');
        }
      } catch (err) {
        toast.error(getServerErrorMessage(err, 'Failed to load registrant outreach setup.'));
        router.push('/dashboard/forms');
      } finally {
        setLoading(false);
      }
    })();
  }, [formId, router]);

  useEffect(() => {
    if (recipients.length === 0) {
      setSelectedRecipientIds([]);
      setSelectionInitialized(false);
      return;
    }

    if (!selectionInitialized) {
      setSelectedRecipientIds(recipients.map((recipient) => recipient.submissionId));
      setSelectionInitialized(true);
      return;
    }

    const availableIds = new Set(recipients.map((recipient) => recipient.submissionId));
    setSelectedRecipientIds((current) => current.filter((id) => availableIds.has(id)));
  }, [recipients, selectionInitialized]);

  const handleLogoFile = (file?: File) => {
    if (!file) {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
      setLogoFile(null);
      setLogoPreview(null);
      return;
    }
    const err = validateImageFile(file);
    if (err) {
      toast.error(err);
      return;
    }
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleImageFile = (file?: File) => {
    if (!file) {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      setImageFile(null);
      setImagePreview(null);
      return;
    }
    const err = validateImageFile(file);
    if (err) {
      toast.error(err);
      return;
    }
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const addResourceLink = () => {
    setResourceLinks((current) => [...current, createEmptyResourceDraft()]);
  };

  const updateResourceLink = (index: number, field: keyof CampaignResourceDraft, value: string) => {
    setResourceLinks((current) =>
      current.map((resource, resourceIndex) =>
        resourceIndex === index
          ? {
              ...resource,
              [field]: value,
            }
          : resource
      )
    );
  };

  const removeResourceLink = (index: number) => {
    setResourceLinks((current) => current.filter((_, resourceIndex) => resourceIndex !== index));
  };

  const toggleRecipientSelection = (submissionId: string) => {
    setSelectedRecipientIds((current) =>
      current.includes(submissionId)
        ? current.filter((id) => id !== submissionId)
        : [...current, submissionId]
    );
  };

  const selectAllRecipients = () => {
    setSelectedRecipientIds(recipients.map((recipient) => recipient.submissionId));
  };

  const clearRecipientSelection = () => {
    setSelectedRecipientIds([]);
  };

  const selectFilteredRecipients = () => {
    setSelectedRecipientIds(filteredRecipients.map((recipient) => recipient.submissionId));
  };

  const selectFirstRecipients = () => {
    const count = Number.parseInt(selectionCount, 10);
    if (!Number.isFinite(count) || count <= 0) {
      toast.error('Enter a valid number of recipients to select.');
      return;
    }
    if (filteredRecipients.length === 0) {
      toast.error('No recipients match the current filter.');
      return;
    }

    setSelectedRecipientIds(filteredRecipients.slice(0, count).map((recipient) => recipient.submissionId));
  };

  const persistCampaignTemplate = async (showSuccessToast = true): Promise<PersistedCampaign> => {
    if (!form) {
      throw new Error('Form not found.');
    }
    if (!subject.trim()) {
      throw new Error('Email subject is required.');
    }
    if (!heading.trim()) {
      throw new Error('Campaign heading is required.');
    }
    if (recipients.length === 0) {
      throw new Error('No valid recipient emails were found for this form yet.');
    }
    if (normalizedCalendar.error) {
      throw new Error(normalizedCalendar.error);
    }
    if (normalizedResources.error) {
      throw new Error(normalizedResources.error);
    }

    setSaving(true);
    try {
      let nextLogoUrl = normalizeAbsoluteHttpUrl(logoUrl);
      let nextImageUrl = normalizeAbsoluteHttpUrl(imageUrl);
      const nextCtaUrl = normalizeAbsoluteHttpUrl(ctaUrl);
      const nextCalendarUrl = normalizeAbsoluteHttpUrl(calendarUrl);

      if (logoUrl.trim() && !nextLogoUrl) {
        throw new Error('Logo URL is invalid. Use a full URL like https://...png');
      }
      if (imageUrl.trim() && !nextImageUrl) {
        throw new Error('Template image URL is invalid. Use a full URL like https://...png');
      }
      if (ctaUrl.trim() && !nextCtaUrl) {
        throw new Error('CTA URL is invalid. Use a full URL like https://...');
      }
      if (calendarUrl.trim() && !nextCalendarUrl) {
        throw new Error('Calendar URL is invalid. Use a full URL like https://...');
      }

      if (logoFile) {
        const uploaded = await apiClient.uploadImage(logoFile, 'email_template');
        nextLogoUrl = uploaded.url;
      }
      if (imageFile) {
        const uploaded = await apiClient.uploadImage(imageFile, 'email_template');
        nextImageUrl = uploaded.url;
      }

      const templateKey = templateKeyPreview || `forms/${form.id}/campaigns/primary`;
      const trimmedMessageHtml = messageHtml.trim() || DEFAULT_MESSAGE_HTML;
      const builtHtml = buildFormEmailHTML({
        title: form.title || 'Registrant Outreach',
        preheader: preheader.trim() || undefined,
        eyebrow: eyebrow.trim() || undefined,
        heading: heading.trim(),
        message: toPlainText(trimmedMessageHtml),
        messageHtml: trimmedMessageHtml,
        logoUrl: nextLogoUrl || undefined,
        imageUrl: nextImageUrl || undefined,
        ctaLabel: ctaLabel.trim() || undefined,
        ctaUrl: nextCtaUrl || undefined,
        resourceLinks: normalizedResources.resourceLinks,
        includeRegistrationCode: true,
        includeCalendarOptIn: Boolean(nextCalendarUrl || normalizedCalendar.event),
        calendarLabel: calendarLabel.trim() || undefined,
        calendarEvent: normalizedCalendar.event,
        greeting: 'Hello {{.RecipientName}},',
        spotlightLabel: spotlightLabel.trim() || undefined,
        spotlightText: spotlightText.trim() || undefined,
        accentColor,
        surfaceColor,
        footerNote: footerNote.trim() || undefined,
      });
      const mergedHTML = customHtmlBody.trim() || builtHtml;
      const builtTextBody = buildFormEmailTextBody({
        title: form.title || 'Registrant Outreach',
        preheader: preheader.trim() || undefined,
        eyebrow: eyebrow.trim() || undefined,
        heading: heading.trim(),
        message: toPlainText(trimmedMessageHtml),
        messageHtml: trimmedMessageHtml,
        ctaLabel: ctaLabel.trim() || undefined,
        ctaUrl: nextCtaUrl || undefined,
        resourceLinks: normalizedResources.resourceLinks,
        calendarLabel: calendarLabel.trim() || undefined,
        calendarUrl: nextCalendarUrl || undefined,
        calendarEvent: normalizedCalendar.event,
        includeCalendarOptIn: Boolean(nextCalendarUrl || normalizedCalendar.event),
        spotlightLabel: spotlightLabel.trim() || undefined,
        spotlightText: spotlightText.trim() || undefined,
        footerNote: footerNote.trim() || undefined,
      });
      const textBody = customHtmlBody.trim()
        ? appendCampaignTextFallback(toPlainText(customHtmlBody), {
            calendarLabel: calendarLabel.trim() || undefined,
            includeCalendarOptIn: Boolean(nextCalendarUrl || normalizedCalendar.event),
            includeRegistrationCode: true,
            resourceLinks: normalizedResources.resourceLinks,
          })
        : builtTextBody;
      const htmlBody = embedTemplateMeta(mergedHTML, {
        preheader: preheader.trim() || undefined,
        eyebrow: eyebrow.trim() || undefined,
        heading: heading.trim(),
        message: toPlainText(trimmedMessageHtml) || undefined,
        messageHtml: trimmedMessageHtml,
        logoUrl: nextLogoUrl || undefined,
        imageUrl: nextImageUrl || undefined,
        ctaLabel: ctaLabel.trim() || undefined,
        ctaUrl: nextCtaUrl || undefined,
        calendarLabel: calendarLabel.trim() || undefined,
        calendarUrl: nextCalendarUrl || undefined,
        calendarEvent: normalizedCalendar.event,
        resourceLinks: normalizedResources.resourceLinks,
        spotlightLabel: spotlightLabel.trim() || undefined,
        spotlightText: spotlightText.trim() || undefined,
        accentColor,
        surfaceColor,
        footerNote: footerNote.trim() || undefined,
        customHtml: customHtmlBody.trim() || undefined,
      } satisfies StoredFormEmailTemplateMeta);

      let savedTemplate: EmailTemplate;
      if (template) {
        savedTemplate = await apiClient.updateAdminEmailTemplate(template.id, {
          templateKey,
          ownerType: 'form_campaign',
          ownerId: form.id,
          subject: subject.trim(),
          htmlBody,
          textBody,
          status: 'active',
          activate: true,
        });
      } else {
        savedTemplate = await apiClient.createAdminEmailTemplate({
          templateKey,
          ownerType: 'form_campaign',
          ownerId: form.id,
          subject: subject.trim(),
          htmlBody,
          textBody,
          status: 'active',
          activate: true,
        });
      }

      const settingsUpdate: UpdateFormRequest = {
        settings: {
          ...form.settings,
          campaignEmailEnabled: true,
          campaignEmailSubject: subject.trim() || undefined,
          campaignEmailTemplateId: savedTemplate.id,
          campaignEmailTemplateKey: templateKey,
          campaignEmailTemplateUrl: nextImageUrl || undefined,
        },
      };
      const updatedForm = await apiClient.updateAdminForm(form.id, settingsUpdate);

      setForm(updatedForm);
      setTemplate(savedTemplate);
      setLogoUrl(nextLogoUrl);
      setImageUrl(nextImageUrl);
      setCtaUrl(nextCtaUrl);
      setCalendarUrl(nextCalendarUrl);
      setLogoFile(null);
      setImageFile(null);
      setLogoPreview(null);
      setImagePreview(null);

      if (showSuccessToast) {
        toast.success('Registrant outreach template saved.');
      }

      return {
        updatedForm,
        savedTemplate,
        htmlBody: mergedHTML,
        textBody,
        calendarUrl: nextCalendarUrl || undefined,
        calendarEvent: normalizedCalendar.event,
        resourceLinks: normalizedResources.resourceLinks,
        heroImageUrl: nextImageUrl || undefined,
        ctaUrl: nextCtaUrl || undefined,
      };
    } finally {
      setSaving(false);
    }
  };

  const saveTemplate = async () => {
    try {
      await persistCampaignTemplate(true);
    } catch (err) {
      toast.error(getServerErrorMessage(err, 'Failed to save outreach template.'));
    }
  };

  const sendCampaign = async () => {
    if (!form) return;
    if (selectedRecipientIds.length === 0) {
      toast.error('Select at least one recipient before sending.');
      return;
    }

    setSending(true);
    try {
      const persisted = await persistCampaignTemplate(false);
      const includeCalendarLinks = Boolean(persisted.calendarUrl || persisted.calendarEvent || form.eventId);
      const result = await sendFormCampaign(form.id, {
        subject: subject.trim() || undefined,
        title: heading.trim() || undefined,
        previewText: preheader.trim() || undefined,
        heroEyebrow: eyebrow.trim() || undefined,
        heroTitle: heading.trim() || undefined,
        heroSubtitle: toPlainText(messageHtml).slice(0, 240) || undefined,
        heroImageUrl: persisted.heroImageUrl,
        htmlBody: persisted.htmlBody,
        textBody: persisted.textBody,
        primaryCta:
          ctaLabel.trim() && persisted.ctaUrl
            ? {
                label: ctaLabel.trim(),
                url: persisted.ctaUrl,
              }
            : undefined,
        footerNote: footerNote.trim() || undefined,
        resourceLinks: persisted.resourceLinks,
        targetSubmissionIds: selectedRecipientIds,
        includeCalendarLinks,
      });

      if (result.failed > 0) {
        toast.error(
          `Campaign sent to ${result.sent} of ${result.totalRecipients} recipients. ${result.failed} failed${result.skipped > 0 ? `, ${result.skipped} skipped` : ''}.`
        );
      } else {
        toast.success(
          `Campaign sent successfully to ${result.sent} recipients${result.skipped > 0 ? `, ${result.skipped} skipped` : ''}.`
        );
      }
    } catch (err) {
      toast.error(getServerErrorMessage(err, 'Failed to send campaign.'));
    } finally {
      setSending(false);
    }
  };

  const copyCampaignHtml = async () => {
    try {
      await navigator.clipboard.writeText(activeHtmlBody);
      toast.success('Campaign HTML copied.');
    } catch {
      toast.error('Failed to copy campaign HTML.');
    }
  };

  const copyCampaignText = async () => {
    try {
      await navigator.clipboard.writeText(activeTextBody);
      toast.success('Campaign text copied.');
    } catch {
      toast.error('Failed to copy campaign text.');
    }
  };

  const downloadCampaignHtml = () => {
    const blob = new Blob([activeHtmlBody], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = campaignHtmlFilename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    toast.success('Campaign HTML downloaded.');
  };

  const copyAudienceEmails = async () => {
    if (recipients.length === 0) {
      toast.error('No valid recipient emails found.');
      return;
    }

    try {
      await navigator.clipboard.writeText(recipients.map((recipient) => recipient.email).join(', '));
      toast.success('Recipient emails copied.');
    } catch {
      toast.error('Failed to copy recipient emails.');
    }
  };

  const exportAudience = () => {
    if (!form || recipients.length === 0) {
      toast.error('No valid recipient emails found.');
      return;
    }
    exportFormCampaignRecipientsCsv(recipients, form.title || form.id);
    toast.success('Audience CSV exported.');
  };

  if (loading) {
    return (
      <div className="flex min-h-[300px] w-full items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-solid border-primary-600 border-r-transparent" />
      </div>
    );
  }

  if (!form) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Registrant Outreach"
          subtitle={`Create and send a polished campaign email to people who registered through ${form.title}.`}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/dashboard/forms/${form.id}/edit`)}
            icon={<ArrowLeft className="h-4 w-4" />}
          >
            Back to Form
          </Button>
          <Button variant="outline" onClick={copyAudienceEmails} icon={<Copy className="h-4 w-4" />}>
            Copy Audience
          </Button>
          <Button variant="outline" onClick={exportAudience} icon={<Download className="h-4 w-4" />}>
            Export Audience
          </Button>
          <Button onClick={saveTemplate} loading={saving} icon={<Save className="h-4 w-4" />}>
            Save Campaign
          </Button>
          <Button
            onClick={sendCampaign}
            loading={sending}
            disabled={selectedRecipientIds.length === 0}
            icon={<Send className="h-4 w-4" />}
          >
            {selectedRecipientIds.length > 0 ? `Send to ${selectedRecipientIds.length}` : 'Select recipients'}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">Submissions</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--color-text-primary)]">
            {audienceStats.totalSubmissions}
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">Valid email records</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--color-text-primary)]">
            {audienceStats.submissionsWithValidEmail}
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">Unique recipients</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--color-text-primary)]">
            {audienceStats.uniqueRecipients}
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">Duplicates or missing</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--color-text-primary)]">
            {audienceStats.duplicateEmails + audienceStats.missingOrInvalidEmail}
          </p>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="space-y-6">
          <Card>
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Email subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Important update for registered guests"
              />
              <Input
                label="Template key"
                value={templateKeyPreview}
                disabled
                helperText="This key keeps the campaign template attached to this form."
              />
              <Input
                label="Inbox preview text (optional)"
                value={preheader}
                onChange={(e) => setPreheader(e.target.value)}
                placeholder="Open this update and save the event in your calendar."
                helperText="This appears as preview text in many inboxes before the email is opened."
              />
              <Input
                label="Eyebrow label"
                value={eyebrow}
                onChange={(e) => setEyebrow(e.target.value)}
                placeholder="Campaign Update"
              />
              <Input
                label="Campaign heading"
                value={heading}
                onChange={(e) => setHeading(e.target.value)}
                placeholder="Here is everything you need before the event"
              />
              <Input
                label="Logo URL (optional)"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://.../logo.png"
              />
              <Input
                label="Flyer / hero image URL (optional)"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://.../flyer.png"
              />
              <Input
                label="Call-to-action label (optional)"
                value={ctaLabel}
                onChange={(e) => setCtaLabel(e.target.value)}
                placeholder="View program details"
              />
              <Input
                label="Call-to-action URL (optional)"
                value={ctaUrl}
                onChange={(e) => setCtaUrl(e.target.value)}
                placeholder="https://your-domain.com/event-details"
                helperText="Use a full URL if you want a button inside the email."
              />
              <div className="space-y-3 rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4 md:col-span-2">
                <div className="text-sm font-medium text-[var(--color-text-primary)]">Calendar Reminder</div>
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  Add the event details once here. The email preview will show a structured reminder card, and the backend can generate a calendar link plus an `.ics` invite for recipients.
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label="Calendar button label"
                    value={calendarLabel}
                    onChange={(e) => setCalendarLabel(e.target.value)}
                    placeholder="Add event to calendar"
                  />
                  <Input
                    label="Manual calendar URL (optional)"
                    value={calendarUrl}
                    onChange={(e) => setCalendarUrl(e.target.value)}
                    placeholder="https://calendar.google.com/... or https://.../invite.ics"
                    helperText="Leave empty to let the backend generate the calendar link from the event details below."
                  />
                  <Input
                    label="Event title"
                    value={calendarTitle}
                    onChange={(e) => setCalendarTitle(e.target.value)}
                    placeholder="WPC 26"
                  />
                  <Input
                    label="Time zone"
                    value={calendarTimeZone}
                    onChange={(e) => setCalendarTimeZone(e.target.value)}
                    placeholder="Africa/Lagos"
                    helperText="Used for the reminder card and generated calendar link."
                  />
                  <label className="space-y-2 text-sm font-medium text-[var(--color-text-secondary)]">
                    Event start
                    <input
                      type="datetime-local"
                      value={calendarStartAt}
                      onChange={(e) => setCalendarStartAt(e.target.value)}
                      className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] focus:ring-offset-2"
                    />
                  </label>
                  <label className="space-y-2 text-sm font-medium text-[var(--color-text-secondary)]">
                    Event end (optional)
                    <input
                      type="datetime-local"
                      value={calendarEndAt}
                      onChange={(e) => setCalendarEndAt(e.target.value)}
                      className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] focus:ring-offset-2"
                    />
                  </label>
                  <div className="md:col-span-2">
                    <Input
                      label="Venue / location (optional)"
                      value={calendarLocation}
                      onChange={(e) => setCalendarLocation(e.target.value)}
                      placeholder="Wisdom House, Abuja"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
                      Calendar description (optional)
                    </label>
                    <textarea
                      className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] focus:ring-offset-2"
                      rows={3}
                      value={calendarDescription}
                      onChange={(e) => setCalendarDescription(e.target.value)}
                      placeholder="Short event summary for the generated calendar invite."
                    />
                  </div>
                </div>
                {normalizedCalendar.error ? (
                  <p className="text-xs font-medium text-red-600">{normalizedCalendar.error}</p>
                ) : (
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    When event details are provided, each outbound email can include a generated add-to-calendar link and attached `.ics` file.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-[var(--color-text-secondary)]">Upload logo (optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleLogoFile(e.target.files?.[0])}
                  className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm"
                />
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  Max {MAX_EMAIL_IMAGE_MB}MB. JPEG, PNG, WebP.
                </p>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
                  Upload flyer / hero image (optional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageFile(e.target.files?.[0])}
                  className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm"
                />
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  Max {MAX_EMAIL_IMAGE_MB}MB. JPEG, PNG, WebP.
                </p>
              </div>

              <div className="space-y-3 rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4 md:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-[var(--color-text-primary)]">Event Resources</div>
                    <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                      Add DigitalOcean or public download links for e-flyers, schedules, documents, or other event resources.
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addResourceLink} icon={<Plus className="h-4 w-4" />}>
                    Add Resource
                  </Button>
                </div>

                {resourceLinks.length > 0 ? (
                  <div className="space-y-4">
                    {resourceLinks.map((resource, index) => (
                      <div
                        key={`${index}-${resource.label}-${resource.url}`}
                        className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-4"
                      >
                        <div className="grid gap-4 md:grid-cols-2">
                          <Input
                            label={`Resource ${index + 1} label`}
                            value={resource.label}
                            onChange={(e) => updateResourceLink(index, 'label', e.target.value)}
                            placeholder="WPC 26 e-flyer"
                          />
                          <label className="space-y-2 text-sm font-medium text-[var(--color-text-secondary)]">
                            Resource type
                            <select
                              value={resource.kind}
                              onChange={(e) => updateResourceLink(index, 'kind', e.target.value)}
                              className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] focus:ring-offset-2"
                            >
                              <option value="flyer">Flyer</option>
                              <option value="document">Document</option>
                              <option value="guide">Guide</option>
                              <option value="schedule">Schedule</option>
                              <option value="resource">General resource</option>
                            </select>
                          </label>
                          <div className="md:col-span-2">
                            <Input
                              label="Download URL"
                              value={resource.url}
                              onChange={(e) => updateResourceLink(index, 'url', e.target.value)}
                              placeholder="https://churchasset.fra1.digitaloceanspaces.com/.../wpc26-flyer.pdf"
                            />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
                              Short description (optional)
                            </label>
                            <textarea
                              className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] focus:ring-offset-2"
                              rows={2}
                              value={resource.description}
                              onChange={(e) => updateResourceLink(index, 'description', e.target.value)}
                              placeholder="Share what the recipient will find after they open or download this file."
                            />
                          </div>
                        </div>
                        <div className="mt-3 flex justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeResourceLink(index)}
                            icon={<Trash2 className="h-4 w-4" />}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-4 py-5 text-sm text-[var(--color-text-tertiary)]">
                    No resource links added yet.
                  </div>
                )}

                {normalizedResources.error ? (
                  <p className="text-xs font-medium text-red-600">{normalizedResources.error}</p>
                ) : (
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    These links render as a professional resource block inside the email and are also sent to the backend for fallback campaign rendering.
                  </p>
                )}
              </div>

              <div className="space-y-3 rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4 md:col-span-2">
                <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)]">
                  <Palette className="h-4 w-4" />
                  Campaign Theme
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-sm font-medium text-[var(--color-text-secondary)]">
                    Accent color
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={accentColor}
                        onChange={(e) => setAccentColor(e.target.value)}
                        className="h-10 w-14 rounded border border-[var(--color-border-primary)] bg-transparent"
                      />
                      <span className="text-xs text-[var(--color-text-tertiary)]">{accentColor}</span>
                    </div>
                  </label>
                  <label className="space-y-2 text-sm font-medium text-[var(--color-text-secondary)]">
                    Surface color
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={surfaceColor}
                        onChange={(e) => setSurfaceColor(e.target.value)}
                        className="h-10 w-14 rounded border border-[var(--color-border-primary)] bg-transparent"
                      />
                      <span className="text-xs text-[var(--color-text-tertiary)]">{surfaceColor}</span>
                    </div>
                  </label>
                </div>
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  These colors style the highlighted scripture card, the call-to-action button, and the visual accent band in the email.
                </p>
              </div>

              <Input
                label="Highlighted section label (optional)"
                value={spotlightLabel}
                onChange={(e) => setSpotlightLabel(e.target.value)}
                placeholder="Genesis 26:22 (NKJV)"
              />
              <div className="space-y-2">
                <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
                  Highlighted section content (optional)
                </label>
                <textarea
                  className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] focus:ring-offset-2"
                  rows={3}
                  value={spotlightText}
                  onChange={(e) => setSpotlightText(e.target.value)}
                  placeholder="For now the Lord has made room for us, and we shall be fruitful in the land."
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="block text-sm font-medium text-[var(--color-text-secondary)]">Campaign body</label>
                <RichTextEditor
                  value={messageHtml}
                  onChange={setMessageHtml}
                  placeholder="Write the full outreach message here. Use headings, bold text, lists, and links for a cleaner campaign structure."
                />
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  Use the structured editor for professional typography. Headings, bold text, lists, links, and the highlighted section will all carry into the final email.
                </p>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="block text-sm font-medium text-[var(--color-text-secondary)]">Footer note (optional)</label>
                <textarea
                  className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] focus:ring-offset-2"
                  rows={2}
                  value={footerNote}
                  onChange={(e) => setFooterNote(e.target.value)}
                  placeholder="You are receiving this email because you registered through this event form."
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
                  Custom HTML template (optional)
                </label>
                <textarea
                  className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 font-mono text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] focus:ring-offset-2"
                  rows={10}
                  value={customHtmlBody}
                  onChange={(e) => setCustomHtmlBody(e.target.value)}
                  placeholder="Paste full HTML only if you want to override the structured builder completely. Supported placeholders: {{.RecipientName}}, {{.RegistrationCode}}, {{.SubscribeURL}}, {{.UnsubscribeURL}}, {{.CalendarOptInURL}}"
                />
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  Leave this empty to use the structured editor, event resource cards, highlighted section, and campaign theme controls above.
                </p>
              </div>
            </div>
          </Card>

          <Card title="Campaign Delivery">
            <div className="space-y-3 text-sm text-[var(--color-text-secondary)]">
              <p>
                This send flow is registrant-specific. It derives the audience directly from this form&apos;s submissions, lets you target a selected segment, deduplicates addresses, and sends one personalized email per selected recipient from a protected server route.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={copyCampaignHtml} icon={<Copy className="h-4 w-4" />}>
                  Copy HTML
                </Button>
                <Button variant="outline" onClick={copyCampaignText} icon={<Copy className="h-4 w-4" />}>
                  Copy Text
                </Button>
                <Button variant="outline" onClick={downloadCampaignHtml} icon={<Download className="h-4 w-4" />}>
                  Download HTML
                </Button>
              </div>
              <div className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)]">
                  <Send className="h-4 w-4" />
                  Delivery controls
                </div>
                <p className="mt-2 text-sm text-[var(--color-text-tertiary)]">
                  SMTP must be configured in the deployment environment for send to succeed. The current template is saved automatically before delivery so uploaded images, resource links, reminder copy, generated calendar links, and `.ics` invites are preserved in the email recipients receive.
                </p>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Audience Targeting">
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  label="Search recipients"
                  value={recipientQuery}
                  onChange={(e) => setRecipientQuery(e.target.value)}
                  placeholder="Search by name, email, or registration code"
                />
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
                    Select first N recipients
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={1}
                      value={selectionCount}
                      onChange={(e) => setSelectionCount(e.target.value)}
                      className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] focus:ring-offset-2"
                      placeholder="25"
                    />
                    <Button type="button" variant="outline" onClick={selectFirstRecipients}>
                      Apply
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={selectAllRecipients}>
                  Select all
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={selectFilteredRecipients}>
                  Select filtered
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={clearRecipientSelection}>
                  Clear selection
                </Button>
              </div>

              <div className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-4 py-3 text-sm">
                <div className="font-medium text-[var(--color-text-primary)]">
                  {selectedRecipients.length} selected of {recipients.length} available recipients
                </div>
                <div className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                  {recipientQuery.trim()
                    ? `${filteredRecipients.length} recipients match your current search and ${selectedFilteredRecipientsCount} of them are selected.`
                    : 'Audience selection is deduplicated by email, so each person only receives one campaign.'}
                </div>
              </div>

              {filteredRecipients.length > 0 ? (
                <div className="max-h-[440px] space-y-2 overflow-y-auto pr-1">
                  {filteredRecipients.map((recipient) => {
                    const checked = selectedRecipientIdSet.has(recipient.submissionId);

                    return (
                      <label
                        key={`${recipient.email}-${recipient.submissionId}`}
                        className={`flex cursor-pointer items-start gap-3 rounded-[var(--radius-card)] border px-4 py-3 transition-colors ${
                          checked
                            ? 'border-[var(--color-accent-primary)] bg-[var(--color-background-secondary)]'
                            : 'border-[var(--color-border-secondary)] bg-[var(--color-background-primary)]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleRecipientSelection(recipient.submissionId)}
                          className="mt-1 h-4 w-4 rounded border-[var(--color-border-primary)] text-[var(--color-accent-primary)] focus:ring-[var(--color-border-focus)]"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-[var(--color-text-primary)]">{recipient.name}</div>
                          <div className="truncate text-xs text-[var(--color-text-secondary)]">{recipient.email}</div>
                          <div className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                            {recipient.registrationCode ? `Reg: ${recipient.registrationCode} · ` : ''}
                            {new Date(recipient.submittedAt).toLocaleString()}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-[var(--color-text-tertiary)]">
                  {recipients.length === 0
                    ? 'No valid email addresses have been captured from this form yet.'
                    : 'No recipients match your current search.'}
                </p>
              )}
            </div>
          </Card>

          <Card title="Template Preview">
            <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-white">
              <iframe title="campaign-email-preview" srcDoc={previewHTML} className="h-[720px] w-full" />
            </div>
            <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">
              The preview uses sample recipient values. Delivery uses the same HTML structure and personalizes each message with the recipient name and registration code.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default withAuth(RegistrantCampaignPage, { requiredRole: 'admin' });
