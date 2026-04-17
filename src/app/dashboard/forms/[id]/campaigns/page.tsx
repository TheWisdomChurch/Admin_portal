'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { ArrowLeft, Copy, Download, Palette, Plus, Save, Send, Trash2 } from 'lucide-react';

import { RichTextEditor } from '@/components/RichTextEditor';
import { PageHeader } from '@/layouts';
import { apiClient } from '@/lib/api';
import { buildCampaignCalendarEventFromEventData, buildCampaignDefaultCopy } from '@/lib/formCampaignCalendar';
import { sendFormCampaign, type SendFormCampaignResult } from '@/lib/formCampaigns';
import {
  ACCEPTED_EMAIL_IMAGE_TYPES,
  DEFAULT_EMAIL_ACCENT_COLOR,
  DEFAULT_EMAIL_SURFACE_COLOR,
  MAX_EMAIL_IMAGE_BYTES,
  MAX_EMAIL_IMAGE_MB,
  buildFormEmailHTML,
  buildFormEmailTextBody,
  buildGoogleCalendarUrl,
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
import { withAuth } from '@/providers/withAuth';
import { ActionStatusModal, type ActionStatusDetail, type ActionStatusMode } from '@/ui/ActionStatusModal';
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

type CampaignActionDialogState = {
  open: boolean;
  mode: ActionStatusMode;
  title: string;
  description: string;
  badge?: string;
  details?: ActionStatusDetail[];
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
    calendarUrl?: string;
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
    output = `${output}\n\nCalendar reminder: open your calendar now and save the event.\n${opts.calendarLabel || 'Add event to calendar'}: ${opts.calendarUrl?.trim() || '{{.CalendarOptInURL}}'}`.trim();
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
  const [ctaEnabled, setCtaEnabled] = useState(false);
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
  const [lastSendResult, setLastSendResult] = useState<SendFormCampaignResult | null>(null);
  const [lastDeliveryError, setLastDeliveryError] = useState<string | null>(null);
  const [actionDialog, setActionDialog] = useState<CampaignActionDialogState>({
    open: false,
    mode: 'info',
    title: '',
    description: '',
  });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [customHtmlBody, setCustomHtmlBody] = useState('');
  const [recipientQuery, setRecipientQuery] = useState('');
  const [selectionCount, setSelectionCount] = useState('');
  const [selectionInitialized, setSelectionInitialized] = useState(false);
  const [previewMode, setPreviewMode] = useState<'rendered' | 'html' | 'text'>('rendered');

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
  const generatedGoogleCalendarUrl = useMemo(
    () => buildGoogleCalendarUrl(normalizedCalendar.event),
    [normalizedCalendar.event]
  );
  const effectiveCalendarUrl = useMemo(() => {
    const manualCalendarUrl = normalizeAbsoluteHttpUrl(calendarUrl);
    return manualCalendarUrl || generatedGoogleCalendarUrl;
  }, [calendarUrl, generatedGoogleCalendarUrl]);
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
        ctaLabel: ctaEnabled ? ctaLabel.trim() || undefined : undefined,
        ctaUrl: ctaEnabled ? ctaUrl.trim() || undefined : undefined,
        calendarUrl: effectiveCalendarUrl || undefined,
        resourceLinks: normalizedResources.resourceLinks,
        includeRegistrationCode: true,
        includeCalendarOptIn: Boolean(effectiveCalendarUrl || normalizedCalendar.event),
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
      effectiveCalendarUrl,
      normalizedCalendar.event,
      ctaEnabled,
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
        ctaLabel: ctaEnabled ? ctaLabel.trim() || undefined : undefined,
        ctaUrl: ctaEnabled ? ctaUrl.trim() || undefined : undefined,
        resourceLinks: normalizedResources.resourceLinks,
        calendarLabel: calendarLabel.trim() || undefined,
        calendarUrl: effectiveCalendarUrl || undefined,
        calendarEvent: normalizedCalendar.event,
        includeCalendarOptIn: Boolean(effectiveCalendarUrl || normalizedCalendar.event),
        spotlightLabel: spotlightLabel.trim() || undefined,
        spotlightText: spotlightText.trim() || undefined,
        footerNote: footerNote.trim() || undefined,
      }),
    [
      preheader,
      calendarLabel,
      effectiveCalendarUrl,
      normalizedCalendar.event,
      ctaEnabled,
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
            calendarUrl: effectiveCalendarUrl || undefined,
            includeCalendarOptIn: Boolean(effectiveCalendarUrl || normalizedCalendar.event),
            includeRegistrationCode: true,
            resourceLinks: normalizedResources.resourceLinks,
          })
        : generatedText,
    [calendarLabel, customHtmlBody, effectiveCalendarUrl, generatedText, normalizedCalendar.event, normalizedResources.resourceLinks]
  );
  const previewHTML = useMemo(() => toEmailPreview(activeHtmlBody), [activeHtmlBody]);

  const campaignHtmlFilename = useMemo(() => {
    const label = form?.slug || form?.title || form?.id || 'registrant-outreach';
    return `${normalizeTemplateSlug(label)}-campaign.html`;
  }, [form?.id, form?.slug, form?.title]);

  const closeActionDialog = () => {
    setActionDialog((current) =>
      current.mode === 'progress' ? current : { ...current, open: false }
    );
  };

  const showActionDialog = (next: Omit<CampaignActionDialogState, 'open'>) => {
    setActionDialog({
      open: true,
      ...next,
    });
  };

  const loadStructuredHtmlIntoEditor = () => {
    setCustomHtmlBody(generatedHtml);
    showActionDialog({
      mode: 'success',
      title: 'Structured HTML loaded',
      description: 'The current email template markup is now in the custom HTML editor, so you can edit the raw HTML directly.',
      badge: 'Custom editor',
      details: [
        { label: 'Source', value: 'Structured campaign builder' },
        { label: 'Mode', value: 'Raw HTML editing enabled' },
      ],
    });
  };

  const clearCustomHtmlOverride = () => {
    setCustomHtmlBody('');
    showActionDialog({
      mode: 'success',
      title: 'Custom HTML cleared',
      description: 'The campaign preview is back on the structured builder. CTA, calendar, resources, and theme controls are active again.',
      badge: 'Structured builder',
    });
  };

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
        setCtaEnabled(false);
        setCtaUrl('');
        setCtaLabel('');
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
          const hasSavedCtaEnabled = Object.prototype.hasOwnProperty.call(meta || {}, 'ctaEnabled');
          const hasSavedCtaLabel = Object.prototype.hasOwnProperty.call(meta || {}, 'ctaLabel');
          const hasSavedCtaUrl = Object.prototype.hasOwnProperty.call(meta || {}, 'ctaUrl');
          if (hasSavedCtaEnabled) setCtaEnabled(Boolean(meta?.ctaEnabled));
          if (hasSavedCtaLabel) setCtaLabel(meta?.ctaLabel || '');
          if (hasSavedCtaUrl) setCtaUrl(meta?.ctaUrl || '');
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
      showActionDialog({
        mode: 'error',
        title: 'Selection count is invalid',
        description: 'Enter a valid number of recipients before applying the audience selection.',
        badge: 'Audience targeting',
      });
      return;
    }
    if (filteredRecipients.length === 0) {
      showActionDialog({
        mode: 'error',
        title: 'No recipients match your filter',
        description: 'Adjust the search term or clear the filter, then try the audience selection again.',
        badge: 'Audience targeting',
      });
      return;
    }

    setSelectedRecipientIds(filteredRecipients.slice(0, count).map((recipient) => recipient.submissionId));
  };

  const persistCampaignTemplate = async (): Promise<PersistedCampaign> => {
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
      const nextManualCalendarUrl = normalizeAbsoluteHttpUrl(calendarUrl);

      if (logoUrl.trim() && !nextLogoUrl) {
        throw new Error('Logo URL is invalid. Use a full URL like https://...png');
      }
      if (imageUrl.trim() && !nextImageUrl) {
        throw new Error('Template image URL is invalid. Use a full URL like https://...png');
      }
      if (ctaEnabled && ctaUrl.trim() && !nextCtaUrl) {
        throw new Error('CTA URL is invalid. Use a full URL like https://...');
      }
      if (calendarUrl.trim() && !nextManualCalendarUrl) {
        throw new Error('Calendar URL is invalid. Use a full URL like https://...');
      }
      const nextEffectiveCalendarUrl = nextManualCalendarUrl || buildGoogleCalendarUrl(normalizedCalendar.event);

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
        ctaLabel: ctaEnabled ? ctaLabel.trim() || undefined : undefined,
        ctaUrl: ctaEnabled ? nextCtaUrl || undefined : undefined,
        calendarUrl: nextEffectiveCalendarUrl || undefined,
        resourceLinks: normalizedResources.resourceLinks,
        includeRegistrationCode: true,
        includeCalendarOptIn: Boolean(nextEffectiveCalendarUrl || normalizedCalendar.event),
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
        ctaLabel: ctaEnabled ? ctaLabel.trim() || undefined : undefined,
        ctaUrl: ctaEnabled ? nextCtaUrl || undefined : undefined,
        resourceLinks: normalizedResources.resourceLinks,
        calendarLabel: calendarLabel.trim() || undefined,
        calendarUrl: nextEffectiveCalendarUrl || undefined,
        calendarEvent: normalizedCalendar.event,
        includeCalendarOptIn: Boolean(nextEffectiveCalendarUrl || normalizedCalendar.event),
        spotlightLabel: spotlightLabel.trim() || undefined,
        spotlightText: spotlightText.trim() || undefined,
        footerNote: footerNote.trim() || undefined,
      });
      const textBody = customHtmlBody.trim()
        ? appendCampaignTextFallback(toPlainText(customHtmlBody), {
            calendarLabel: calendarLabel.trim() || undefined,
            calendarUrl: nextEffectiveCalendarUrl || undefined,
            includeCalendarOptIn: Boolean(nextEffectiveCalendarUrl || normalizedCalendar.event),
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
        ctaEnabled,
        ctaLabel: ctaLabel.trim(),
        ctaUrl: nextCtaUrl || '',
        calendarLabel: calendarLabel.trim() || undefined,
        calendarUrl: nextManualCalendarUrl || undefined,
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
      setCalendarUrl(nextManualCalendarUrl);
      setLogoFile(null);
      setImageFile(null);
      setLogoPreview(null);
      setImagePreview(null);

      return {
        updatedForm,
        savedTemplate,
        htmlBody: mergedHTML,
        textBody,
        calendarUrl: nextEffectiveCalendarUrl || undefined,
        calendarEvent: normalizedCalendar.event,
        resourceLinks: normalizedResources.resourceLinks,
        heroImageUrl: nextImageUrl || undefined,
        ctaUrl: ctaEnabled ? nextCtaUrl || undefined : undefined,
      };
    } finally {
      setSaving(false);
    }
  };

  const saveTemplate = async () => {
    showActionDialog({
      mode: 'progress',
      title: 'Saving campaign',
      description: 'We are validating your content, uploading any selected assets, and syncing the live campaign template.',
      badge: 'Campaign editor',
      details: [
        { label: 'Subject', value: subject.trim() || 'Untitled campaign' },
        { label: 'Audience', value: `${recipients.length} available recipients` },
      ],
    });

    try {
      const persisted = await persistCampaignTemplate();
      showActionDialog({
        mode: 'success',
        title: 'Campaign saved',
        description: 'Your campaign structure is now stored and ready for delivery.',
        badge: 'Campaign ready',
        details: [
          { label: 'Subject', value: subject.trim() || 'Untitled campaign' },
          { label: 'Template', value: templateKeyPreview || persisted.savedTemplate.templateKey || persisted.savedTemplate.id },
          { label: 'Resources', value: `${persisted.resourceLinks?.length || 0}` },
          { label: 'Calendar', value: persisted.calendarUrl || persisted.calendarEvent ? 'Included' : 'Not included' },
        ],
      });
    } catch (err) {
      const message = getServerErrorMessage(err, 'Failed to save outreach template.');
      showActionDialog({
        mode: 'error',
        title: 'Campaign save failed',
        description: message,
        badge: 'Campaign editor',
      });
    }
  };

  const sendCampaign = async () => {
    if (!form) return;
    if (selectedRecipientIds.length === 0) {
      showActionDialog({
        mode: 'error',
        title: 'No recipients selected',
        description: 'Select at least one recipient before sending this campaign.',
        badge: 'Delivery blocked',
      });
      return;
    }

    setSending(true);
    setLastDeliveryError(null);
    showActionDialog({
      mode: 'progress',
      title: 'Sending campaign',
      description: 'We are saving the latest template state, personalizing each email, and handing delivery to the backend mail service.',
      badge: 'Delivery in progress',
      details: [
        { label: 'Recipients', value: `${selectedRecipientIds.length}` },
        { label: 'Subject', value: subject.trim() || 'Untitled campaign' },
      ],
    });
    try {
      const persisted = await persistCampaignTemplate();
      const includeCalendarLinks = Boolean(form.eventId);
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
          ctaEnabled && ctaLabel.trim() && persisted.ctaUrl
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
      setLastSendResult(result);

      const firstFailureDetail = result.failedRecipientDetails?.find(
        (detail) => detail?.error?.trim() && detail?.email?.trim()
      );
      const failureHint =
        result.failureReason?.trim() ||
        firstFailureDetail?.error?.trim() ||
        undefined;

      if (result.failed > 0) {
        showActionDialog({
          mode: 'error',
          title: 'Campaign delivery completed with failures',
          description:
            failureHint ||
            'Some recipients could not be reached. Review the delivery details below and correct the backend mail setup if needed.',
          badge: 'Delivery review',
          details: [
            { label: 'Targeted', value: `${result.totalRecipients}` },
            { label: 'Sent', value: `${result.sent}` },
            { label: 'Failed', value: `${result.failed}` },
            { label: 'Skipped', value: `${result.skipped}` },
          ],
        });
      } else {
        showActionDialog({
          mode: 'success',
          title: 'Campaign sent successfully',
          description: 'The backend accepted the delivery request and started sending personalized emails to your selected registrants.',
          badge: 'Delivery complete',
          details: [
            { label: 'Targeted', value: `${result.totalRecipients}` },
            { label: 'Sent', value: `${result.sent}` },
            { label: 'Template source', value: result.templateSource || 'structured editor' },
            { label: 'Subject', value: result.subject || subject.trim() || 'Untitled campaign' },
          ],
        });
      }
    } catch (err) {
      const message = getServerErrorMessage(err, 'Failed to send campaign.');
      setLastSendResult(null);
      setLastDeliveryError(message);
      showActionDialog({
        mode: 'error',
        title: 'Campaign delivery failed',
        description: message,
        badge: 'Backend response',
        details: [
          { label: 'Recipients', value: `${selectedRecipientIds.length}` },
          { label: 'Subject', value: subject.trim() || 'Untitled campaign' },
        ],
      });
    } finally {
      setSending(false);
    }
  };

  const copyCampaignHtml = async () => {
    try {
      await navigator.clipboard.writeText(activeHtmlBody);
      showActionDialog({
        mode: 'success',
        title: 'Campaign HTML copied',
        description: 'The full HTML markup has been copied to your clipboard.',
        badge: 'Clipboard ready',
        details: [
          { label: 'Template file', value: campaignHtmlFilename },
          { label: 'Content type', value: 'HTML email markup' },
        ],
      });
    } catch {
      showActionDialog({
        mode: 'error',
        title: 'Could not copy campaign HTML',
        description: 'The browser blocked clipboard access for this action. Try again or use the download button.',
        badge: 'Clipboard error',
      });
    }
  };

  const copyCampaignText = async () => {
    try {
      await navigator.clipboard.writeText(activeTextBody);
      showActionDialog({
        mode: 'success',
        title: 'Campaign text copied',
        description: 'The plain-text version of this campaign has been copied to your clipboard.',
        badge: 'Clipboard ready',
        details: [
          { label: 'Audience', value: `${recipients.length} available recipients` },
          { label: 'Content type', value: 'Plain-text email copy' },
        ],
      });
    } catch {
      showActionDialog({
        mode: 'error',
        title: 'Could not copy campaign text',
        description: 'The browser blocked clipboard access for this action. Try again after granting clipboard permission.',
        badge: 'Clipboard error',
      });
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
    showActionDialog({
      mode: 'success',
      title: 'Campaign HTML downloaded',
      description: 'The email template file has been generated and downloaded for review or external delivery use.',
      badge: 'Download complete',
      details: [
        { label: 'File', value: campaignHtmlFilename },
        { label: 'Format', value: 'HTML' },
      ],
    });
  };

  const copyAudienceEmails = async () => {
    if (recipients.length === 0) {
      showActionDialog({
        mode: 'error',
        title: 'No audience emails available',
        description: 'This form does not currently have any valid recipient email addresses to copy.',
        badge: 'Audience unavailable',
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(recipients.map((recipient) => recipient.email).join(', '));
      showActionDialog({
        mode: 'success',
        title: 'Audience emails copied',
        description: 'The deduplicated recipient email list has been copied to your clipboard.',
        badge: 'Clipboard ready',
        details: [
          { label: 'Recipients', value: `${recipients.length}` },
          { label: 'Source', value: form?.title || 'Registrant audience' },
        ],
      });
    } catch {
      showActionDialog({
        mode: 'error',
        title: 'Could not copy audience emails',
        description: 'The browser blocked clipboard access for the audience list.',
        badge: 'Clipboard error',
      });
    }
  };

  const exportAudience = () => {
    if (!form || recipients.length === 0) {
      showActionDialog({
        mode: 'error',
        title: 'No audience available to export',
        description: 'This form does not currently have any valid recipient email addresses to export.',
        badge: 'Export unavailable',
      });
      return;
    }
    exportFormCampaignRecipientsCsv(recipients, form.title || form.id);
    showActionDialog({
      mode: 'success',
      title: 'Audience exported',
      description: 'The campaign audience has been exported as a CSV file for offline review or reporting.',
      badge: 'Export complete',
      details: [
        { label: 'Recipients', value: `${recipients.length}` },
        { label: 'Form', value: form.title || form.id },
      ],
    });
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
      <ActionStatusModal
        open={actionDialog.open}
        mode={actionDialog.mode}
        title={actionDialog.title}
        description={actionDialog.description}
        badge={actionDialog.badge}
        details={actionDialog.details}
        onClose={closeActionDialog}
      />

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
              <div className="space-y-3 rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4 md:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-[var(--color-text-primary)]">Call-to-action Button</div>
                    <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                      This is now opt-in. The outreach template will not show a registration button unless you enable it here.
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)]">
                    <input
                      type="checkbox"
                      checked={ctaEnabled}
                      onChange={(e) => setCtaEnabled(e.target.checked)}
                      className="h-4 w-4 rounded border-[var(--color-border-primary)] text-[var(--color-accent-primary)] focus:ring-[var(--color-border-focus)]"
                    />
                    Enable CTA
                  </label>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label="Call-to-action label (optional)"
                    value={ctaLabel}
                    onChange={(e) => setCtaLabel(e.target.value)}
                    placeholder="View program details"
                    helperText={ctaEnabled ? 'Use the label you want on the email button.' : 'Turn on Enable CTA if you want a button in the email.'}
                    disabled={!ctaEnabled}
                  />
                  <Input
                    label="Call-to-action URL (optional)"
                    value={ctaUrl}
                    onChange={(e) => setCtaUrl(e.target.value)}
                    placeholder="https://your-domain.com/event-details"
                    helperText={ctaEnabled ? 'Use a full URL like https://your-domain.com/event-details' : 'CTA is disabled, so no registration button will appear in the email.'}
                    disabled={!ctaEnabled}
                  />
                </div>
              </div>
              <div className="space-y-3 rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4 md:col-span-2">
                <div className="text-sm font-medium text-[var(--color-text-primary)]">Calendar Reminder</div>
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  Add the event details once here. The email preview will show a structured reminder card, and the editor can generate a real Google Calendar link from the schedule you choose.
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
                    helperText="Leave empty to auto-generate a Google Calendar link from the event details below."
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
                  <div className="space-y-2">
                    <p className="text-xs text-[var(--color-text-tertiary)]">
                      When event details are provided, the campaign email can include a direct Google Calendar link immediately. Backend-generated `.ics` delivery still depends on the linked form event pipeline.
                    </p>
                    {effectiveCalendarUrl ? (
                      <div className="rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 py-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
                          {calendarUrl.trim() ? 'Manual calendar URL' : 'Generated Google Calendar URL'}
                        </div>
                        <a
                          href={effectiveCalendarUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 block break-all text-sm font-medium text-[var(--color-accent-primary)] underline underline-offset-4"
                        >
                          {effectiveCalendarUrl}
                        </a>
                      </div>
                    ) : null}
                  </div>
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
                              placeholder="https://zecqbhqstwhiwwjpphep.storage.supabase.co/storage/v1/s3/forms/wpc26-flyer.pdf"
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
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
                    Custom HTML template (optional)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={loadStructuredHtmlIntoEditor}>
                      Load Structured HTML
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearCustomHtmlOverride}
                      disabled={!customHtmlBody.trim()}
                    >
                      Clear Override
                    </Button>
                  </div>
                </div>
                <textarea
                  className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 font-mono text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] focus:ring-offset-2"
                  rows={10}
                  value={customHtmlBody}
                  onChange={(e) => setCustomHtmlBody(e.target.value)}
                  placeholder="Paste full HTML only if you want to override the structured builder completely. Supported placeholders: {{.RecipientName}}, {{.FirstName}}, {{.RegistrationCode}}, {{.SubscribeURL}}, {{.UnsubscribeURL}}, {{.CalendarOptInURL}}, {{.GoogleCalendarURL}}, {{.CalendarICSURL}}"
                />
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  Use “Load Structured HTML” to pull the current campaign markup into this editor, then adjust the raw HTML directly. The preview panel updates from this override automatically, so you can inspect the rendered email and the raw HTML side by side. Leave this empty to use the structured editor, event resource cards, highlighted section, and campaign theme controls above.
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
              {lastDeliveryError ? (
                <div className="rounded-[var(--radius-card)] border border-red-300 bg-red-50 p-4">
                  <div className="text-sm font-semibold text-red-700">Last backend delivery error</div>
                  <p className="mt-2 text-sm text-red-700">{lastDeliveryError}</p>
                </div>
              ) : null}
              {lastSendResult ? (
                <div className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
                  {(() => {
                    const failedRecipientDetails = Array.isArray(lastSendResult.failedRecipientDetails)
                      ? lastSendResult.failedRecipientDetails
                      : [];
                    const failedRecipients = Array.isArray(lastSendResult.failedRecipients)
                      ? lastSendResult.failedRecipients
                      : [];

                    return (
                      <>
                  <div className="text-sm font-semibold text-[var(--color-text-primary)]">Last delivery result</div>
                  <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                    Sent {lastSendResult.sent} of {lastSendResult.totalRecipients} targeted recipients
                    {lastSendResult.skipped > 0 ? `, with ${lastSendResult.skipped} skipped` : ''}.
                  </p>
                  {lastSendResult.failureReason ? (
                    <p className="mt-2 text-sm text-red-700">Backend reported: {lastSendResult.failureReason}</p>
                  ) : null}
                  {failedRecipientDetails.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      <div className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">
                        Failed recipients
                      </div>
                      <div className="space-y-2 text-sm text-[var(--color-text-secondary)]">
                        {failedRecipientDetails.slice(0, 5).map((detail) => (
                          <div
                            key={`${detail.email}-${detail.error}`}
                            className="rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 py-2"
                          >
                            <div className="font-medium text-[var(--color-text-primary)]">{detail.email}</div>
                            <div className="mt-1 text-xs text-red-700">{detail.error}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : failedRecipients.length > 0 ? (
                    <div className="mt-3">
                      <div className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">
                        Failed recipients
                      </div>
                      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                        {failedRecipients.slice(0, 8).join(', ')}
                        {failedRecipients.length > 8 ? ' ...' : ''}
                      </p>
                    </div>
                  ) : null}
                      </>
                    );
                  })()}
                </div>
              ) : null}
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
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-[var(--color-text-tertiary)]">
                {customHtmlBody.trim()
                  ? 'Previewing your full HTML override.'
                  : 'Previewing the structured campaign builder.'}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={previewMode === 'rendered' ? 'primary' : 'outline'}
                  onClick={() => setPreviewMode('rendered')}
                >
                  Rendered
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={previewMode === 'html' ? 'primary' : 'outline'}
                  onClick={() => setPreviewMode('html')}
                >
                  HTML
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={previewMode === 'text' ? 'primary' : 'outline'}
                  onClick={() => setPreviewMode('text')}
                >
                  Text
                </Button>
              </div>
            </div>
            <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-white">
              {previewMode === 'rendered' ? (
                <iframe title="campaign-email-preview" srcDoc={previewHTML} className="h-[720px] w-full" />
              ) : (
                <pre className="h-[720px] overflow-auto whitespace-pre-wrap bg-[var(--color-background-primary)] p-4 font-mono text-xs text-[var(--color-text-primary)]">
                  {previewMode === 'html' ? activeHtmlBody : activeTextBody}
                </pre>
              )}
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
