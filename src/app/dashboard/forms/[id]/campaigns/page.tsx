'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { ArrowLeft, Copy, Download, Palette, Save, Send } from 'lucide-react';

import { RichTextEditor } from '@/components/RichTextEditor';
import { PageHeader } from '@/layouts';
import { apiClient } from '@/lib/api';
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
import type { AdminForm, EmailTemplate, FormSubmission, UpdateFormRequest } from '@/lib/types';
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

function appendCampaignTextFallback(
  value: string,
  opts: {
    calendarLabel?: string;
    includeCalendarOptIn?: boolean;
    includeRegistrationCode?: boolean;
  }
) {
  let output = value.trim();

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
  const [accentColor, setAccentColor] = useState(DEFAULT_EMAIL_ACCENT_COLOR);
  const [surfaceColor, setSurfaceColor] = useState(DEFAULT_EMAIL_SURFACE_COLOR);

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [customHtmlBody, setCustomHtmlBody] = useState('');

  const recipients = useMemo(() => extractFormCampaignRecipients(submissions), [submissions]);
  const audienceStats = useMemo(() => buildAudienceStats(submissions, recipients), [submissions, recipients]);
  const latestRecipients = useMemo(() => recipients.slice(0, 8), [recipients]);
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
          })
        : generatedText,
    [calendarLabel, calendarUrl, customHtmlBody, generatedText, normalizedCalendar.event]
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

    (async () => {
      try {
        const [loadedForm, allSubmissions, templatesResponse] = await Promise.all([
          apiClient.getAdminForm(formId),
          fetchAllFormSubmissions(formId),
          apiClient.listAdminEmailTemplates({
            page: 1,
            limit: 50,
            ownerType: 'form_campaign',
            ownerId: formId,
          }),
        ]);

        setForm(loadedForm);
        setSubmissions(allSubmissions);

        const subjectFallback =
          loadedForm.settings?.campaignEmailSubject?.trim() || `Update for ${loadedForm.title}`;
        setSubject(subjectFallback);
        setImageUrl(loadedForm.settings?.campaignEmailTemplateUrl?.trim() || '');
        setCtaUrl(buildPublicFormUrl(loadedForm.slug, loadedForm.publicUrl) || '');
        setCalendarTitle((current) => current || loadedForm.title || '');

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

    setSending(true);
    try {
      const persisted = await persistCampaignTemplate(false);
      const result = await sendFormCampaign(form.id, {
        subject: subject.trim(),
        title: heading.trim(),
        htmlBody: persisted.htmlBody,
        textBody: persisted.textBody,
        calendarUrl: persisted.calendarUrl,
        calendarEvent: persisted.calendarEvent,
      });

      if (result.failed > 0) {
        toast.error(`Campaign sent to ${result.sent} of ${result.totalRecipients} recipients. ${result.failed} failed.`);
      } else {
        toast.success(`Campaign sent successfully to ${result.sent} recipients.`);
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
          <Button onClick={sendCampaign} loading={sending} icon={<Send className="h-4 w-4" />}>
            Send Campaign
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
                  Leave this empty to use the structured editor, highlighted scripture section, and campaign theme controls above.
                </p>
              </div>
            </div>
          </Card>

          <Card title="Campaign Delivery">
            <div className="space-y-3 text-sm text-[var(--color-text-secondary)]">
              <p>
                This send flow is registrant-specific. It derives the audience directly from this form&apos;s submissions, deduplicates addresses, and sends one personalized email per recipient from a protected server route.
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
                  SMTP must be configured in the deployment environment for send to succeed. The current template is saved automatically before delivery so uploaded images, reminder copy, generated calendar links, and `.ics` invites are preserved in the email recipients receive.
                </p>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Audience Snapshot">
            {latestRecipients.length > 0 ? (
              <div className="space-y-3">
                {latestRecipients.map((recipient) => (
                  <div
                    key={`${recipient.email}-${recipient.submissionId}`}
                    className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-4 py-3"
                  >
                    <div className="text-sm font-medium text-[var(--color-text-primary)]">{recipient.name}</div>
                    <div className="text-xs text-[var(--color-text-secondary)]">{recipient.email}</div>
                    <div className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                      {recipient.registrationCode ? `Reg: ${recipient.registrationCode} · ` : ''}
                      {new Date(recipient.submittedAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--color-text-tertiary)]">
                No valid email addresses have been captured from this form yet.
              </p>
            )}
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
