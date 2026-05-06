'use client';

import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  CalendarDays,
  Copy,
  Download,
  Eye,
  FileCode2,
  Loader2,
  Mail,
  Palette,
  Save,
  Search,
  Send,
  Users,
  Activity,
} from 'lucide-react';

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

type WorkspaceTab = 'compose' | 'audience' | 'preview';

const DEFAULT_MESSAGE_HTML = [
  '<p>Thank you for registering. We are sharing this update so you have the latest details, announcements, and event resources before the day.</p>',
  '<p>Please review the information below and keep this email for quick reference.</p>',
].join('');

const DEFAULT_PREHEADER = 'Important event update for registered guests. Open this email and save the date in your calendar.';
const DEFAULT_CALENDAR_LABEL = 'Add event to calendar';

function createEmptyResourceDraft(): CampaignResourceDraft {
  return { label: '', url: '', description: '', kind: 'flyer' };
}

function buildAudienceStats(submissions: FormSubmission[], recipients: FormCampaignRecipient[]): AudienceStats {
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
  if (!ACCEPTED_EMAIL_IMAGE_TYPES.includes(file.type)) return 'Image must be JPEG, PNG, or WebP.';
  if (file.size > MAX_EMAIL_IMAGE_BYTES) return `Image must be ${MAX_EMAIL_IMAGE_MB}MB or smaller.`;
  return null;
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

function toRichTextHtml(value: string) {
  const segments = value.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  if (segments.length === 0) return DEFAULT_MESSAGE_HTML;
  return segments.map((segment) => `<p>${segment.replace(/\n/g, '<br />')}</p>`).join('');
}

function toDateTimeLocalValue(value?: string) {
  if (!value?.trim()) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const localTime = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000);
  return localTime.toISOString().slice(0, 16);
}

function normalizeCampaignCalendarDraft(draft: CampaignCalendarDraft): { event?: FormEmailCalendarEvent; error?: string } {
  const title = draft.title.trim();
  const location = draft.location.trim();
  const description = draft.description.trim();
  const timeZone = draft.timeZone.trim();
  const startAtRaw = draft.startAt.trim();
  const endAtRaw = draft.endAt.trim();
  const hasAnyValue = [title, location, description, timeZone, startAtRaw, endAtRaw].some(Boolean);

  if (!hasAnyValue) return {};
  if (!title) return { error: 'Calendar event title is required once you add calendar details.' };
  if (!startAtRaw) return { error: 'Calendar start time is required once you add calendar details.' };

  const startAt = new Date(startAtRaw);
  if (Number.isNaN(startAt.getTime())) return { error: 'Calendar start time is invalid.' };

  let endAt: Date | undefined;
  if (endAtRaw) {
    endAt = new Date(endAtRaw);
    if (Number.isNaN(endAt.getTime())) return { error: 'Calendar end time is invalid.' };
    if (endAt.getTime() <= startAt.getTime()) return { error: 'Calendar end time must be after the start time.' };
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

function normalizeCampaignResourceDrafts(drafts: CampaignResourceDraft[]): { resourceLinks: FormEmailResourceLink[]; error?: string } {
  const resourceLinks: FormEmailResourceLink[] = [];

  for (let index = 0; index < drafts.length; index += 1) {
    const draft = drafts[index];
    const label = draft.label.trim();
    const url = draft.url.trim();
    const description = draft.description.trim();
    const kind = draft.kind.trim().toLowerCase() || 'resource';
    const hasAnyValue = [label, url, description].some(Boolean);

    if (!hasAnyValue) continue;
    if (!label) return { resourceLinks: [], error: `Resource ${index + 1} needs a label.` };
    if (!url) return { resourceLinks: [], error: `Resource ${index + 1} needs a URL.` };
    if (label.length > 80) return { resourceLinks: [], error: `Resource ${index + 1} label must be 80 characters or fewer.` };
    if (description.length > 200) return { resourceLinks: [], error: `Resource ${index + 1} description must be 200 characters or fewer.` };

    const normalizedUrl = normalizeAbsoluteHttpUrl(url);
    if (!normalizedUrl) return { resourceLinks: [], error: `Resource ${index + 1} URL is invalid. Use a full URL like https://...` };

    resourceLinks.push({ label, url: normalizedUrl, description: description || undefined, kind });
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
  },
) {
  let output = value.trim();

  if (opts.resourceLinks?.length) {
    const resourceLines = opts.resourceLinks.flatMap((resource) => {
      const label = resource.label?.trim();
      const url = resource.url?.trim();
      if (!label || !url) return [];
      const description = resource.description?.trim();
      return [`${label}: ${url}`, ...(description ? [description] : [])];
    });

    if (resourceLines.length > 0) output = `${output}\n\nEvent resources:\n${resourceLines.join('\n')}`.trim();
  }

  if (opts.includeCalendarOptIn && !output.includes('{{.CalendarOptInURL}}')) {
    output = `${output}\n\nCalendar reminder: open your calendar now and save the event.\n${opts.calendarLabel || 'Add event to calendar'}: ${opts.calendarUrl?.trim() || '{{.CalendarOptInURL}}'}`.trim();
  }

  if (opts.includeRegistrationCode && !output.includes('{{.RegistrationCode}}')) {
    output = `${output}\n\nRegistration Number: {{.RegistrationCode}}`.trim();
  }

  return output;
}

function Panel({ title, subtitle, icon: Icon, actions, children }: { title: string; subtitle?: string; icon?: ComponentType<{ className?: string }>; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:shadow-md">
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          {Icon ? <div className="rounded-2xl bg-slate-950 p-3 text-white shadow-sm"><Icon className="h-5 w-5" /></div> : null}
          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-950">{title}</h2>
            {subtitle ? <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{subtitle}</p> : null}
          </div>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function StatCard({ label, value, hint, icon: Icon }: { label: string; value: number | string; hint: string; icon: ComponentType<{ className?: string }> }) {
  return (
    <article className="overflow-hidden rounded-[1.7rem] border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
          <strong className="mt-3 block text-3xl font-black tracking-tight text-slate-950">{value}</strong>
        </div>
        <div className="rounded-2xl bg-slate-950 p-3 text-white"><Icon className="h-5 w-5" /></div>
      </div>
      <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">{hint}</p>
    </article>
  );
}

function TabButton({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-2xl px-4 py-2 text-sm font-black transition ${active ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`}>
      {children}
    </button>
  );
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
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('compose');

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
  const [actionDialog, setActionDialog] = useState<CampaignActionDialogState>({ open: false, mode: 'info', title: '', description: '' });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [customHtmlBody, setCustomHtmlBody] = useState('');
  const [recipientQuery, setRecipientQuery] = useState('');
  const [selectionCount, setSelectionCount] = useState('');
  const [selectionInitialized, setSelectionInitialized] = useState(false);
  const [previewMode, setPreviewMode] = useState<'rendered' | 'html' | 'text'>('rendered');
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);

  const recipients = useMemo(() => extractFormCampaignRecipients(submissions), [submissions]);
  const audienceStats = useMemo(() => buildAudienceStats(submissions, recipients), [submissions, recipients]);
  const messageText = useMemo(() => toPlainText(messageHtml), [messageHtml]);

  const normalizedCalendar = useMemo(() => normalizeCampaignCalendarDraft({ title: calendarTitle, startAt: calendarStartAt, endAt: calendarEndAt, location: calendarLocation, description: calendarDescription, timeZone: calendarTimeZone }), [calendarDescription, calendarEndAt, calendarLocation, calendarStartAt, calendarTimeZone, calendarTitle]);
  const normalizedResources = useMemo(() => normalizeCampaignResourceDrafts(resourceLinks), [resourceLinks]);
  const generatedGoogleCalendarUrl = useMemo(() => buildGoogleCalendarUrl(normalizedCalendar.event), [normalizedCalendar.event]);
  const effectiveCalendarUrl = useMemo(() => normalizeAbsoluteHttpUrl(calendarUrl) || generatedGoogleCalendarUrl, [calendarUrl, generatedGoogleCalendarUrl]);

  const filteredRecipients = useMemo(() => {
    const term = recipientQuery.trim().toLowerCase();
    if (!term) return recipients;
    return recipients.filter((recipient) => [recipient.name, recipient.email, recipient.registrationCode, new Date(recipient.submittedAt).toLocaleString()].filter(Boolean).join(' ').toLowerCase().includes(term));
  }, [recipientQuery, recipients]);

  const selectedRecipientIdSet = useMemo(() => new Set(selectedRecipientIds), [selectedRecipientIds]);
  const selectedRecipients = useMemo(() => recipients.filter((recipient) => selectedRecipientIdSet.has(recipient.submissionId)), [recipients, selectedRecipientIdSet]);
  const selectedFilteredRecipientsCount = useMemo(() => filteredRecipients.filter((recipient) => selectedRecipientIdSet.has(recipient.submissionId)).length, [filteredRecipients, selectedRecipientIdSet]);

  const templateKeyPreview = useMemo(() => {
    const existing = form?.settings?.campaignEmailTemplateKey?.trim();
    if (existing) return existing;
    if (form?.slug) return `forms/${form.slug}/campaigns/primary`;
    if (form?.title) return `forms/${normalizeTemplateSlug(form.title)}/campaigns/primary`;
    if (form?.id) return `forms/${form.id}/campaigns/primary`;
    return '';
  }, [form]);

  const generatedHtml = useMemo(() => buildFormEmailHTML({
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
  }), [accentColor, calendarLabel, effectiveCalendarUrl, normalizedCalendar.event, ctaEnabled, ctaLabel, ctaUrl, eyebrow, footerNote, form?.title, heading, imagePreview, imageUrl, logoPreview, logoUrl, messageHtml, messageText, preheader, spotlightLabel, spotlightText, surfaceColor, normalizedResources.resourceLinks]);

  const generatedText = useMemo(() => buildFormEmailTextBody({
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
  }), [preheader, calendarLabel, effectiveCalendarUrl, normalizedCalendar.event, ctaEnabled, ctaLabel, ctaUrl, eyebrow, footerNote, form?.title, heading, messageHtml, messageText, spotlightLabel, spotlightText, normalizedResources.resourceLinks]);

  const activeHtmlBody = useMemo(() => customHtmlBody.trim() || generatedHtml, [customHtmlBody, generatedHtml]);
  const activeTextBody = useMemo(() => customHtmlBody.trim() ? appendCampaignTextFallback(toPlainText(customHtmlBody), { calendarLabel: calendarLabel.trim() || undefined, calendarUrl: effectiveCalendarUrl || undefined, includeCalendarOptIn: Boolean(effectiveCalendarUrl || normalizedCalendar.event), includeRegistrationCode: true, resourceLinks: normalizedResources.resourceLinks }) : generatedText, [calendarLabel, customHtmlBody, effectiveCalendarUrl, generatedText, normalizedCalendar.event, normalizedResources.resourceLinks]);
  const previewHTML = useMemo(() => toEmailPreview(activeHtmlBody), [activeHtmlBody]);

  const campaignHtmlFilename = useMemo(() => `${normalizeTemplateSlug(form?.slug || form?.title || form?.id || 'registrant-outreach')}-campaign.html`, [form?.id, form?.slug, form?.title]);

  const closeActionDialog = () => setActionDialog((current) => current.mode === 'progress' ? current : { ...current, open: false });
  const showActionDialog = (next: Omit<CampaignActionDialogState, 'open'>) => setActionDialog({ open: true, ...next });

  useEffect(() => () => {
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
  }, [logoPreview, imagePreview]);

  useEffect(() => {
    const detectedTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (detectedTimeZone) setCalendarTimeZone((current) => current || detectedTimeZone);
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
          apiClient.listAdminEmailTemplates({ page: 1, limit: 50, ownerType: 'form_campaign', ownerId: formId }),
          loadedForm.eventId ? apiClient.getAdminEvent(loadedForm.eventId).catch(() => null) : Promise.resolve(null),
        ]);

        const smartDefaults = buildCampaignDefaultCopy(loadedForm.title, loadedEvent as EventData | null);
        const fallbackCalendarEvent = buildCampaignCalendarEventFromEventData(loadedEvent as EventData | null, Intl.DateTimeFormat().resolvedOptions().timeZone || undefined);

        setForm(loadedForm);
        setSubmissions(allSubmissions);
        setSubject(loadedForm.settings?.campaignEmailSubject?.trim() || smartDefaults.subject);
        setPreheader(smartDefaults.preheader);
        setHeading(smartDefaults.heading);
        setImageUrl(loadedForm.settings?.campaignEmailTemplateUrl?.trim() || loadedEvent?.bannerImage?.trim() || loadedEvent?.image?.trim() || '');

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
          if (Object.prototype.hasOwnProperty.call(meta || {}, 'ctaEnabled')) setCtaEnabled(Boolean(meta?.ctaEnabled));
          if (Object.prototype.hasOwnProperty.call(meta || {}, 'ctaLabel')) setCtaLabel(meta?.ctaLabel || '');
          if (Object.prototype.hasOwnProperty.call(meta || {}, 'ctaUrl')) setCtaUrl(meta?.ctaUrl || '');
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
          if (meta?.resourceLinks?.length) setResourceLinks(meta.resourceLinks.map((resource) => ({ label: resource.label || '', url: resource.url || '', description: resource.description || '', kind: resource.kind || 'resource' })));
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

  const addResourceLink = () => setResourceLinks((current) => [...current, createEmptyResourceDraft()]);
  const updateResourceLink = (index: number, field: keyof CampaignResourceDraft, value: string) => {
    setResourceLinks((current) => current.map((resource, resourceIndex) => resourceIndex === index ? { ...resource, [field]: value } : resource));
  };
  const removeResourceLink = (index: number) => setResourceLinks((current) => current.filter((_, resourceIndex) => resourceIndex !== index));

  const toggleRecipientSelection = (submissionId: string) => {
    setSelectedRecipientIds((current) => current.includes(submissionId) ? current.filter((id) => id !== submissionId) : [...current, submissionId]);
  };
  const selectAllRecipients = () => setSelectedRecipientIds(recipients.map((recipient) => recipient.submissionId));
  const clearRecipientSelection = () => setSelectedRecipientIds([]);
  const selectFilteredRecipients = () => setSelectedRecipientIds(filteredRecipients.map((recipient) => recipient.submissionId));

  const selectFirstRecipients = () => {
    const count = Number.parseInt(selectionCount, 10);
    if (!Number.isFinite(count) || count <= 0) {
      showActionDialog({ mode: 'error', title: 'Selection count is invalid', description: 'Enter a valid number of recipients before applying the audience selection.', badge: 'Audience targeting' });
      return;
    }
    if (filteredRecipients.length === 0) {
      showActionDialog({ mode: 'error', title: 'No recipients match your filter', description: 'Adjust the search term or clear the filter, then try the audience selection again.', badge: 'Audience targeting' });
      return;
    }
    setSelectedRecipientIds(filteredRecipients.slice(0, count).map((recipient) => recipient.submissionId));
  };

  const persistCampaignTemplate = async (): Promise<PersistedCampaign> => {
    if (!form) throw new Error('Form not found.');
    if (!subject.trim()) throw new Error('Email subject is required.');
    if (!heading.trim()) throw new Error('Campaign heading is required.');
    if (recipients.length === 0) throw new Error('No valid recipient emails were found for this form yet.');
    if (normalizedCalendar.error) throw new Error(normalizedCalendar.error);
    if (normalizedResources.error) throw new Error(normalizedResources.error);

    setSaving(true);
    try {
      let nextLogoUrl = normalizeAbsoluteHttpUrl(logoUrl);
      let nextImageUrl = normalizeAbsoluteHttpUrl(imageUrl);
      const nextCtaUrl = normalizeAbsoluteHttpUrl(ctaUrl);
      const nextManualCalendarUrl = normalizeAbsoluteHttpUrl(calendarUrl);

      if (logoUrl.trim() && !nextLogoUrl) throw new Error('Logo URL is invalid. Use a full URL like https://...png');
      if (imageUrl.trim() && !nextImageUrl) throw new Error('Template image URL is invalid. Use a full URL like https://...png');
      if (ctaEnabled && ctaUrl.trim() && !nextCtaUrl) throw new Error('CTA URL is invalid. Use a full URL like https://...');
      if (calendarUrl.trim() && !nextManualCalendarUrl) throw new Error('Calendar URL is invalid. Use a full URL like https://...');

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
        ? appendCampaignTextFallback(toPlainText(customHtmlBody), { calendarLabel: calendarLabel.trim() || undefined, calendarUrl: nextEffectiveCalendarUrl || undefined, includeCalendarOptIn: Boolean(nextEffectiveCalendarUrl || normalizedCalendar.event), includeRegistrationCode: true, resourceLinks: normalizedResources.resourceLinks })
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

      const savedTemplate = template
        ? await apiClient.updateAdminEmailTemplate(template.id, { templateKey, ownerType: 'form_campaign', ownerId: form.id, subject: subject.trim(), htmlBody, textBody, status: 'active', activate: true })
        : await apiClient.createAdminEmailTemplate({ templateKey, ownerType: 'form_campaign', ownerId: form.id, subject: subject.trim(), htmlBody, textBody, status: 'active', activate: true });

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

      return { updatedForm, savedTemplate, htmlBody: mergedHTML, textBody, calendarUrl: nextEffectiveCalendarUrl || undefined, calendarEvent: normalizedCalendar.event, resourceLinks: normalizedResources.resourceLinks, heroImageUrl: nextImageUrl || undefined, ctaUrl: ctaEnabled ? nextCtaUrl || undefined : undefined };
    } finally {
      setSaving(false);
    }
  };

  const saveTemplate = async () => {
    showActionDialog({ mode: 'progress', title: 'Saving campaign', description: 'Validating content, uploading selected assets, and syncing the active template.', badge: 'Campaign editor', details: [{ label: 'Subject', value: subject.trim() || 'Untitled campaign' }, { label: 'Audience', value: `${recipients.length} available recipients` }] });
    try {
      const persisted = await persistCampaignTemplate();
      showActionDialog({ mode: 'success', title: 'Campaign saved', description: 'Your campaign structure is now stored and ready for delivery.', badge: 'Campaign ready', details: [{ label: 'Subject', value: subject.trim() || 'Untitled campaign' }, { label: 'Template', value: templateKeyPreview || persisted.savedTemplate.templateKey || persisted.savedTemplate.id }, { label: 'Resources', value: `${persisted.resourceLinks?.length || 0}` }, { label: 'Calendar', value: persisted.calendarUrl || persisted.calendarEvent ? 'Included' : 'Not included' }] });
    } catch (err) {
      showActionDialog({ mode: 'error', title: 'Campaign save failed', description: getServerErrorMessage(err, 'Failed to save outreach template.'), badge: 'Campaign editor' });
    }
  };

  const sendCampaign = async () => {
    if (!form) return;
    if (selectedRecipientIds.length === 0) {
      showActionDialog({ mode: 'error', title: 'No recipients selected', description: 'Select at least one recipient before sending this campaign.', badge: 'Delivery blocked' });
      return;
    }

    setSending(true);
    setLastDeliveryError(null);
    showActionDialog({ mode: 'progress', title: 'Sending campaign', description: 'Saving the latest template state and preparing delivery.', badge: 'Delivery in progress', details: [{ label: 'Recipients', value: `${selectedRecipientIds.length}` }, { label: 'Subject', value: subject.trim() || 'Untitled campaign' }] });

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
        primaryCta: ctaEnabled && ctaLabel.trim() && persisted.ctaUrl ? { label: ctaLabel.trim(), url: persisted.ctaUrl } : undefined,
        footerNote: footerNote.trim() || undefined,
        resourceLinks: persisted.resourceLinks,
        targetSubmissionIds: selectedRecipientIds,
        includeCalendarLinks,
      });

      setLastSendResult(result);

      const firstFailureDetail = result.failedRecipientDetails?.find((detail) => detail?.error?.trim() && detail?.email?.trim());
      const failureHint = result.failureReason?.trim() || firstFailureDetail?.error?.trim() || undefined;

      if (result.failed > 0) {
        showActionDialog({ mode: 'error', title: 'Campaign delivery completed with failures', description: failureHint || 'Some recipients could not be reached.', badge: 'Delivery review', details: [{ label: 'Targeted', value: `${result.totalRecipients}` }, { label: 'Sent', value: `${result.sent}` }, { label: 'Failed', value: `${result.failed}` }, { label: 'Skipped', value: `${result.skipped}` }] });
      } else {
        showActionDialog({ mode: 'success', title: 'Campaign sent successfully', description: 'Personalized emails are being sent to the selected registrants.', badge: 'Delivery complete', details: [{ label: 'Targeted', value: `${result.totalRecipients}` }, { label: 'Sent', value: `${result.sent}` }, { label: 'Subject', value: result.subject || subject.trim() || 'Untitled campaign' }] });
      }
    } catch (err) {
      const message = getServerErrorMessage(err, 'Failed to send campaign.');
      setLastSendResult(null);
      setLastDeliveryError(message);
      showActionDialog({ mode: 'error', title: 'Campaign delivery failed', description: message, badge: 'Delivery response' });
    } finally {
      setSending(false);
    }
  };

  const copyCampaignHtml = async () => {
    try {
      await navigator.clipboard.writeText(activeHtmlBody);
      showActionDialog({ mode: 'success', title: 'Campaign HTML copied', description: 'The full HTML markup has been copied to your clipboard.', badge: 'Clipboard ready' });
    } catch {
      showActionDialog({ mode: 'error', title: 'Could not copy campaign HTML', description: 'The browser blocked clipboard access for this action.', badge: 'Clipboard error' });
    }
  };

  const copyCampaignText = async () => {
    try {
      await navigator.clipboard.writeText(activeTextBody);
      showActionDialog({ mode: 'success', title: 'Campaign text copied', description: 'The plain-text version has been copied.', badge: 'Clipboard ready' });
    } catch {
      showActionDialog({ mode: 'error', title: 'Could not copy campaign text', description: 'The browser blocked clipboard access.', badge: 'Clipboard error' });
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
    showActionDialog({ mode: 'success', title: 'Campaign HTML downloaded', description: 'The email template file has been generated and downloaded.', badge: 'Download complete' });
  };

  const copyAudienceEmails = async () => {
    if (recipients.length === 0) {
      showActionDialog({ mode: 'error', title: 'No audience emails available', description: 'This form does not currently have any valid recipient email addresses.', badge: 'Audience unavailable' });
      return;
    }
    try {
      await navigator.clipboard.writeText(recipients.map((recipient) => recipient.email).join(', '));
      showActionDialog({ mode: 'success', title: 'Audience emails copied', description: 'The deduplicated recipient list has been copied.', badge: 'Clipboard ready' });
    } catch {
      showActionDialog({ mode: 'error', title: 'Could not copy audience emails', description: 'The browser blocked clipboard access.', badge: 'Clipboard error' });
    }
  };

  const exportAudience = () => {
    if (!form || recipients.length === 0) {
      showActionDialog({ mode: 'error', title: 'No audience available to export', description: 'This form does not currently have any valid recipient email addresses to export.', badge: 'Export unavailable' });
      return;
    }
    exportFormCampaignRecipientsCsv(recipients, form.title || form.id);
    showActionDialog({ mode: 'success', title: 'Audience exported', description: 'The campaign audience has been exported as a CSV file.', badge: 'Export complete' });
  };

  const loadStructuredHtmlIntoEditor = () => {
    setCustomHtmlBody(generatedHtml);
    showActionDialog({ mode: 'success', title: 'Structured HTML loaded', description: 'The current template markup is now in the custom HTML editor.', badge: 'Custom editor' });
  };

  const clearCustomHtmlOverride = () => {
    setCustomHtmlBody('');
    showActionDialog({ mode: 'success', title: 'Custom HTML cleared', description: 'The campaign preview is back on the structured builder.', badge: 'Structured builder' });
  };

  if (loading) return <div className="flex min-h-[300px] w-full items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-slate-950" /></div>;
  if (!form) return null;

  return (
    <main className="space-y-6">
      <ActionStatusModal open={actionDialog.open} mode={actionDialog.mode} title={actionDialog.title} description={actionDialog.description} badge={actionDialog.badge} details={actionDialog.details} onClose={closeActionDialog} />

      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <PageHeader title="Registrant Outreach" subtitle={`Create and send a polished campaign email to people who registered through ${form.title}.`} />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => router.push(`/dashboard/forms/${form.id}/edit`)} icon={<ArrowLeft className="h-4 w-4" />}>Back to Form</Button>
          <Button variant="outline" onClick={copyAudienceEmails} icon={<Copy className="h-4 w-4" />}>Copy Audience</Button>
          <Button variant="outline" onClick={exportAudience} icon={<Download className="h-4 w-4" />}>Export Audience</Button>
          <Button onClick={() => void saveTemplate()} loading={saving} icon={<Save className="h-4 w-4" />}>Save Campaign</Button>
          <Button onClick={() => void sendCampaign()} loading={sending} disabled={selectedRecipientIds.length === 0} icon={<Send className="h-4 w-4" />}>{selectedRecipientIds.length > 0 ? `Send to ${selectedRecipientIds.length}` : 'Select recipients'}</Button>
        </div>
      </div>

      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-950 p-6 text-white shadow-xl">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-white/65"><Mail className="h-4 w-4" />Registrant email campaign</div>
            <h1 className="mt-4 max-w-4xl text-3xl font-black tracking-tight sm:text-4xl">Compose, preview, target, and send from one professional campaign studio.</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/65">The audience is deduplicated directly from form submissions, and the template is saved before sending.</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-white/50">Template key</p>
            <p className="mt-2 break-all text-sm font-bold text-white/75">{templateKeyPreview}</p>
            <p className="mt-2 text-xs font-semibold text-white/45">{selectedRecipients.length} selected recipients</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={FileCode2} label="Submissions" value={audienceStats.totalSubmissions} hint="All submissions captured by the form." />
        <StatCard icon={Mail} label="Valid email records" value={audienceStats.submissionsWithValidEmail} hint="Submissions with usable email addresses." />
        <StatCard icon={Users} label="Unique recipients" value={audienceStats.uniqueRecipients} hint="Deduplicated by email before delivery." />
        <StatCard icon={Activity} label="Duplicates or missing" value={audienceStats.duplicateEmails + audienceStats.missingOrInvalidEmail} hint="Skipped or deduplicated records." />
      </section>

      <section className="sticky top-2 z-20 rounded-3xl border border-slate-200 bg-white/85 p-2 shadow-sm backdrop-blur">
        <div className="flex gap-2 overflow-x-auto"><TabButton active={activeTab === 'compose'} onClick={() => setActiveTab('compose')}>Compose</TabButton><TabButton active={activeTab === 'audience'} onClick={() => setActiveTab('audience')}>Audience</TabButton><TabButton active={activeTab === 'preview'} onClick={() => setActiveTab('preview')}>Preview</TabButton></div>
      </section>

      {activeTab === 'compose' ? (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_420px]">
          <Panel title="Campaign message" subtitle="Write the campaign subject, preview text, hero copy, media, CTA, and rich body." icon={Mail}>
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Email subject" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Important update for registered guests" />
              <Input label="Template key" value={templateKeyPreview} disabled />
              <Input label="Inbox preview text" value={preheader} onChange={(event) => setPreheader(event.target.value)} placeholder="Open this update and save the event." />
              <Input label="Eyebrow label" value={eyebrow} onChange={(event) => setEyebrow(event.target.value)} placeholder="Campaign Update" />
              <Input label="Campaign heading" value={heading} onChange={(event) => setHeading(event.target.value)} placeholder="Here is everything you need before the event" />
              <Input label="Logo URL" value={logoUrl} onChange={(event) => setLogoUrl(event.target.value)} placeholder="https://.../logo.png" />
              <Input label="Flyer / hero image URL" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="https://.../flyer.png" />
              <div className="space-y-2"><label className="block text-sm font-bold text-slate-600">Upload logo</label><input type="file" accept="image/*" onChange={(event) => handleLogoFile(event.target.files?.[0])} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold" /><p className="text-xs font-semibold text-slate-400">Max {MAX_EMAIL_IMAGE_MB}MB. JPEG, PNG, WebP.</p></div>
              <div className="space-y-2"><label className="block text-sm font-bold text-slate-600">Upload flyer / hero image</label><input type="file" accept="image/*" onChange={(event) => handleImageFile(event.target.files?.[0])} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold" /><p className="text-xs font-semibold text-slate-400">Max {MAX_EMAIL_IMAGE_MB}MB. JPEG, PNG, WebP.</p></div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><p className="text-sm font-black text-slate-950">Call-to-action button</p><p className="mt-1 text-xs font-semibold text-slate-500">Optional. No button appears unless enabled.</p></div>
                  <label className="flex items-center gap-2 text-sm font-black text-slate-600"><input type="checkbox" checked={ctaEnabled} onChange={(event) => setCtaEnabled(event.target.checked)} />Enable CTA</label>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2"><Input label="CTA label" value={ctaLabel} onChange={(event) => setCtaLabel(event.target.value)} disabled={!ctaEnabled} /><Input label="CTA URL" value={ctaUrl} onChange={(event) => setCtaUrl(event.target.value)} disabled={!ctaEnabled} /></div>
              </div>

              <div className="space-y-2 md:col-span-2"><label className="block text-sm font-bold text-slate-600">Campaign body</label><RichTextEditor value={messageHtml} onChange={setMessageHtml} placeholder="Write the full outreach message here." /></div>
            </div>
          </Panel>

          <div className="space-y-6">
            <Panel title="Calendar reminder" subtitle="Generate or attach a calendar link for the event." icon={CalendarDays}>
              <div className="grid gap-4">
                <Input label="Calendar button label" value={calendarLabel} onChange={(event) => setCalendarLabel(event.target.value)} />
                <Input label="Manual calendar URL" value={calendarUrl} onChange={(event) => setCalendarUrl(event.target.value)} />
                <Input label="Event title" value={calendarTitle} onChange={(event) => setCalendarTitle(event.target.value)} />
                <Input label="Time zone" value={calendarTimeZone} onChange={(event) => setCalendarTimeZone(event.target.value)} />
                <label className="space-y-2 text-sm font-bold text-slate-600">Event start<input type="datetime-local" value={calendarStartAt} onChange={(event) => setCalendarStartAt(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold" /></label>
                <label className="space-y-2 text-sm font-bold text-slate-600">Event end<input type="datetime-local" value={calendarEndAt} onChange={(event) => setCalendarEndAt(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold" /></label>
                <Input label="Venue / location" value={calendarLocation} onChange={(event) => setCalendarLocation(event.target.value)} />
                <label className="grid gap-1.5"><span className="text-sm font-bold text-slate-600">Calendar description</span><textarea className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold leading-7 outline-none" rows={3} value={calendarDescription} onChange={(event) => setCalendarDescription(event.target.value)} /></label>
                {normalizedCalendar.error ? <p className="text-xs font-bold text-red-600">{normalizedCalendar.error}</p> : null}
                {effectiveCalendarUrl ? <a href={effectiveCalendarUrl} target="_blank" rel="noreferrer" className="break-all rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-600 underline">{effectiveCalendarUrl}</a> : null}
              </div>
            </Panel>

            <Panel title="Theme and highlight" subtitle="Control colors and optional highlighted section." icon={Palette}>
              <div className="grid gap-4">
                <ColorInput label="Accent color" value={accentColor} onChange={setAccentColor} />
                <ColorInput label="Surface color" value={surfaceColor} onChange={setSurfaceColor} />
                <Input label="Highlighted label" value={spotlightLabel} onChange={(event) => setSpotlightLabel(event.target.value)} />
                <label className="grid gap-1.5"><span className="text-sm font-bold text-slate-600">Highlighted content</span><textarea className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold leading-7 outline-none" rows={3} value={spotlightText} onChange={(event) => setSpotlightText(event.target.value)} /></label>
                <label className="grid gap-1.5"><span className="text-sm font-bold text-slate-600">Footer note</span><textarea className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold leading-7 outline-none" rows={2} value={footerNote} onChange={(event) => setFooterNote(event.target.value)} /></label>

                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-950">Resource links</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">Add flyers, schedules, documents, or download links.</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={addResourceLink}>Add</Button>
                  </div>
                  <div className="mt-4 space-y-3">
                    {resourceLinks.length === 0 ? <p className="text-xs font-semibold text-slate-400">No resource links added.</p> : null}
                    {resourceLinks.map((resource, index) => (
                      <div key={`${index}-${resource.kind}`} className="rounded-2xl border border-slate-200 bg-white p-3">
                        <div className="grid gap-2">
                          <input value={resource.label} onChange={(event) => updateResourceLink(index, 'label', event.target.value)} placeholder="Resource label" className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold outline-none" />
                          <input value={resource.url} onChange={(event) => updateResourceLink(index, 'url', event.target.value)} placeholder="https://..." className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold outline-none" />
                          <textarea value={resource.description} onChange={(event) => updateResourceLink(index, 'description', event.target.value)} placeholder="Short description" rows={2} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold outline-none" />
                          <div className="flex items-center justify-between gap-2">
                            <select value={resource.kind} onChange={(event) => updateResourceLink(index, 'kind', event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black outline-none">
                              <option value="flyer">Flyer</option>
                              <option value="document">Document</option>
                              <option value="guide">Guide</option>
                              <option value="schedule">Schedule</option>
                              <option value="resource">Resource</option>
                            </select>
                            <Button type="button" variant="ghost" size="sm" onClick={() => removeResourceLink(index)}>Remove</Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {normalizedResources.error ? <p className="mt-3 text-xs font-bold text-red-600">{normalizedResources.error}</p> : null}
                </div>
              </div>
            </Panel>
          </div>
        </section>
      ) : null}

      {activeTab === 'audience' ? (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Panel title="Audience targeting" subtitle="Search, select, and send to a precise deduplicated recipient segment." icon={Users}>
            <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_240px]">
              <div className="relative"><Search className="absolute left-3 top-9 h-4 w-4 text-slate-400" /><Input label="Search recipients" value={recipientQuery} onChange={(event) => setRecipientQuery(event.target.value)} placeholder="Search by name, email, or registration code" className="pl-10" /></div>
              <div className="space-y-1"><label className="block text-sm font-bold text-slate-600">Select first N recipients</label><div className="flex gap-2"><input type="number" min={1} value={selectionCount} onChange={(event) => setSelectionCount(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold" placeholder="25" /><Button type="button" variant="outline" onClick={selectFirstRecipients}>Apply</Button></div></div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" onClick={selectAllRecipients}>Select all</Button><Button type="button" size="sm" variant="outline" onClick={selectFilteredRecipients}>Select filtered</Button><Button type="button" size="sm" variant="ghost" onClick={clearRecipientSelection}>Clear selection</Button></div>
            <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"><div className="font-black text-slate-950">{selectedRecipients.length} selected of {recipients.length} available recipients</div><div className="mt-1 text-xs font-semibold text-slate-500">{recipientQuery.trim() ? `${filteredRecipients.length} recipients match your current search and ${selectedFilteredRecipientsCount} of them are selected.` : 'Audience selection is deduplicated by email.'}</div></div>
            <div className="mt-4 max-h-[560px] space-y-2 overflow-y-auto pr-1">
              {filteredRecipients.length > 0 ? filteredRecipients.map((recipient) => {
                const checked = selectedRecipientIdSet.has(recipient.submissionId);
                return <label key={`${recipient.email}-${recipient.submissionId}`} className={`flex cursor-pointer items-start gap-3 rounded-3xl border px-4 py-3 transition-colors ${checked ? 'border-slate-950 bg-slate-50' : 'border-slate-200 bg-white'}`}><input type="checkbox" checked={checked} onChange={() => toggleRecipientSelection(recipient.submissionId)} className="mt-1 h-4 w-4 rounded border-slate-300" /><div className="min-w-0 flex-1"><div className="text-sm font-black text-slate-950">{recipient.name}</div><div className="truncate text-xs font-semibold text-slate-500">{recipient.email}</div><div className="mt-1 text-xs font-semibold text-slate-400">{recipient.registrationCode ? `Reg: ${recipient.registrationCode} · ` : ''}{new Date(recipient.submittedAt).toLocaleString()}</div></div></label>;
              }) : <EmptyState label={recipients.length === 0 ? 'No valid email addresses have been captured from this form yet.' : 'No recipients match your current search.'} />}
            </div>
          </Panel>

          <Panel title="Delivery result" subtitle="Review the most recent send result and failures." icon={Send}>
            <div className="space-y-4">
              {lastDeliveryError ? <div className="rounded-3xl border border-red-200 bg-red-50 p-4"><div className="text-sm font-black text-red-700">Last delivery error</div><p className="mt-2 text-sm font-semibold leading-6 text-red-700">{lastDeliveryError}</p></div> : null}
              {lastSendResult ? <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4"><div className="text-sm font-black text-slate-950">Last delivery result</div><p className="mt-2 text-sm font-semibold leading-6 text-slate-600">Sent {lastSendResult.sent} of {lastSendResult.totalRecipients} targeted recipients{lastSendResult.skipped > 0 ? `, with ${lastSendResult.skipped} skipped` : ''}.</p>{lastSendResult.failureReason ? <p className="mt-2 text-sm font-semibold text-red-700">Delivery reported: {lastSendResult.failureReason}</p> : null}</div> : <EmptyState label="No delivery result yet." />}
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-black text-slate-950">Delivery controls</p><p className="mt-2 text-sm font-semibold leading-6 text-slate-500">SMTP must be configured in the deployment environment. The current template is saved automatically before sending.</p></div>
            </div>
          </Panel>
        </section>
      ) : null}

      {activeTab === 'preview' ? (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Panel title="Template preview" subtitle={customHtmlBody.trim() ? 'Previewing your full HTML override.' : 'Previewing the structured campaign builder.'} icon={Eye} actions={<div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant={previewMode === 'rendered' ? 'primary' : 'outline'} onClick={() => setPreviewMode('rendered')}>Rendered</Button><Button type="button" size="sm" variant={previewMode === 'html' ? 'primary' : 'outline'} onClick={() => setPreviewMode('html')}>HTML</Button><Button type="button" size="sm" variant={previewMode === 'text' ? 'primary' : 'outline'} onClick={() => setPreviewMode('text')}>Text</Button></div>}>
            <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white">{previewMode === 'rendered' ? <iframe title="campaign-email-preview" srcDoc={previewHTML} className="h-[760px] w-full" /> : <pre className="h-[760px] overflow-auto whitespace-pre-wrap bg-slate-950 p-4 font-mono text-xs text-slate-100">{previewMode === 'html' ? activeHtmlBody : activeTextBody}</pre>}</div>
          </Panel>
          <div className="space-y-6">
            <Panel title="Custom HTML override" subtitle="Use only when you need full raw control over the final email HTML." icon={FileCode2}>
              <div className="space-y-3"><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" onClick={loadStructuredHtmlIntoEditor}>Load Structured HTML</Button><Button type="button" variant="ghost" size="sm" onClick={clearCustomHtmlOverride} disabled={!customHtmlBody.trim()}>Clear Override</Button></div><textarea className="h-[360px] w-full rounded-2xl border border-slate-200 bg-slate-950 px-3 py-2 font-mono text-xs leading-6 text-slate-100 outline-none" value={customHtmlBody} onChange={(event) => setCustomHtmlBody(event.target.value)} placeholder="Paste full HTML only if you want to override the structured builder completely." /></div>
            </Panel>
            <Panel title="Export tools" subtitle="Copy or download the campaign assets for review." icon={Download}>
              <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void copyCampaignHtml()} icon={<Copy className="h-4 w-4" />}>Copy HTML</Button><Button variant="outline" onClick={() => void copyCampaignText()} icon={<Copy className="h-4 w-4" />}>Copy Text</Button><Button variant="outline" onClick={downloadCampaignHtml} icon={<Download className="h-4 w-4" />}>Download HTML</Button></div>
            </Panel>
          </div>
        </section>
      ) : null}
    </main>
  );
}

export default withAuth(RegistrantCampaignPage, { requiredRole: 'admin' });

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-bold text-slate-600">{label}</span>
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2">
        <input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-8 w-12 rounded border border-slate-200 bg-transparent" />
        <span className="text-xs font-black text-slate-500">{value}</span>
      </div>
    </label>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center"><p className="text-sm font-bold text-slate-500">{label}</p></div>;
}
