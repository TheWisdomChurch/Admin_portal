'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Eye,
  FileText,
  Image as ImageIcon,
  Loader2,
  Mail,
  MailCheck,
  Paperclip,
  RefreshCw,
  Search,
  Send,
  Users,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { apiClient } from '@/lib/api';
import { getServerErrorMessage } from '@/lib/serverValidation';
import type {
  AdminEmailAttachmentInput,
  AdminEmailAudiencePreview,
  AdminEmailDeliveryHistoryItem,
  AdminEmailMarketingFormItem,
  AdminEmailMarketingSummary,
  AdminEmailRecipientInput,
  SendAdminComposeEmailRequest,
  SendAdminComposeEmailResponse,
} from '@/lib/types';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { withAuth } from '@/providers/withAuth';

import styles from './email-marketing.module.scss';

// Design tokens mirror internal/email/theme.go on the backend (the single
// source of truth for what a Wisdom Church email looks like). Keep these in
// sync if that palette ever changes.
const EMAIL_COLOR_INK = '#0E1420';
const EMAIL_COLOR_PAPER = '#FFFFFF';
const EMAIL_COLOR_GROUND = '#EEF0F3';
const EMAIL_COLOR_ACCENT = '#8A6D2F';
const EMAIL_COLOR_LINE = '#DADFE6';
const EMAIL_COLOR_MUTED = '#5B6472';
const EMAIL_COLOR_FAINT = '#8A93A3';
const EMAIL_COLOR_BODY = '#3A414D';
const EMAIL_FONT_STACK = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
// Served by the backend from an embedded asset — see internal/email/embedded.go
// and the GET route for email.LogoAssetPath in cmd/api/router.go. This must
// always be an absolute URL to the *backend's* own origin (never a relative
// or same-origin-proxied path): email clients render this HTML standalone,
// with no Next.js app context to resolve a relative path against. Not the
// admin portal's own domain, and not the old pre-redesign /OIP.webp path.
function resolveEmailLogoURL(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL;
  const origin = raw ? raw.trim().replace(/\/+$/, '').replace(/\/api\/v1$/, '') : '';
  return `${origin || 'https://api.wisdomchurchhq.org'}/assets/logo.webp`;
}
const EMAIL_LOGO_URL = resolveEmailLogoURL();

const EMAIL_BRAND_HEADER = `<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="width:56px;vertical-align:middle;"><img src="${EMAIL_LOGO_URL}" width="56" height="56" alt="The Wisdom Church" style="display:block;width:56px;height:56px;border-radius:14px;object-fit:cover;" /></td>
<td style="width:1px;padding:0 10px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="1" height="52" style="width:1px;font-size:0;line-height:0;background:${EMAIL_COLOR_LINE};">&nbsp;</td></tr></table></td>
<td style="vertical-align:middle;font-family:${EMAIL_FONT_STACK};">
<div style="font-size:13px;font-weight:400;color:${EMAIL_COLOR_MUTED};line-height:1.3;">The</div>
<div style="font-size:18px;font-weight:800;letter-spacing:-.01em;color:${EMAIL_COLOR_INK};line-height:1.25;">Wisdom Church</div>
<div style="font-size:10.5px;font-style:italic;font-weight:500;color:${EMAIL_COLOR_ACCENT};letter-spacing:.01em;margin-top:5px;">Equipped. Empowered for Greatness</div>
</td>
</tr></table>`;

const EMAIL_FOOTER = `<tr><td style="padding:0 40px;"><div style="border-top:1px solid ${EMAIL_COLOR_LINE};"></div></td></tr>
<tr><td style="padding:24px 40px 32px;font-family:${EMAIL_FONT_STACK};">
<p style="margin:0 0 4px;font-size:12px;color:${EMAIL_COLOR_FAINT};">The Wisdom Church</p>
<p style="margin:0;font-size:12px;color:${EMAIL_COLOR_FAINT};">Prefer not to receive these emails? <a href="{{ .UnsubscribeURL }}" style="color:${EMAIL_COLOR_ACCENT};text-decoration:none;">Unsubscribe here</a>.</p>
</td></tr>`;

function buildEmailHTML(heading: string, bodyHTML: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${EMAIL_COLOR_GROUND};"><tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:${EMAIL_COLOR_PAPER};border:1px solid ${EMAIL_COLOR_LINE};font-family:${EMAIL_FONT_STACK};">
<tr><td style="height:3px;line-height:3px;font-size:0;background:${EMAIL_COLOR_ACCENT};">&nbsp;</td></tr>
<tr><td style="padding:36px 40px 28px;">${EMAIL_BRAND_HEADER}</td></tr>
<tr><td style="padding:0 40px;"><div style="border-top:1px solid ${EMAIL_COLOR_LINE};"></div></td></tr>
<tr><td style="padding:32px 40px;font-family:${EMAIL_FONT_STACK};color:${EMAIL_COLOR_BODY};font-size:15px;line-height:1.7;">
<h1 style="margin:0 0 20px;color:${EMAIL_COLOR_INK};font-size:24px;line-height:1.3;font-weight:800;">${heading}</h1>
${bodyHTML}
</td></tr>
${EMAIL_FOOTER}
</table>
</td></tr></table>`;
}

// A church "eflier" is a full-width promotional banner image spliced into the
// very top of the rendered email — above even the brand header — using a pair
// of HTML comment markers so it can be added, swapped, or removed regardless
// of which template preset or hand-edited HTML is currently in the composer.
const EFLIER_MARKER_START = '<!-- EFLIER:START -->';
const EFLIER_MARKER_END = '<!-- EFLIER:END -->';
const EFLIER_BLOCK_RE = /<!-- EFLIER:START -->[\s\S]*?<!-- EFLIER:END -->/;
const EMAIL_CARD_OPEN_TAG = '<table role="presentation" width="600"';

function buildEflierRow(url: string): string {
  return `${EFLIER_MARKER_START}<tr><td style="padding:0;line-height:0;font-size:0;"><img src="${url}" width="600" alt="" style="display:block;width:100%;max-width:600px;height:auto;border:0;" /></td></tr>${EFLIER_MARKER_END}`;
}

function applyEflierToHtml(html: string, eflierUrl: string | null): string {
  const withoutEflier = html.replace(EFLIER_BLOCK_RE, '');
  if (!eflierUrl) return withoutEflier;
  const cardOpenIndex = withoutEflier.indexOf(EMAIL_CARD_OPEN_TAG);
  if (cardOpenIndex === -1) return withoutEflier;
  const insertAt = withoutEflier.indexOf('>', cardOpenIndex) + 1;
  return `${withoutEflier.slice(0, insertAt)}${buildEflierRow(eflierUrl)}${withoutEflier.slice(insertAt)}`;
}

const DEFAULT_HTML_TEMPLATE = buildEmailHTML(
  'A timely update for you',
  `<p style="margin:0 0 16px;">Hello {{ .FirstName }},</p>
<p style="margin:0 0 16px;">We are reaching out with a new update from The Wisdom Church. Thank you for staying connected with the house.</p>
<p style="margin:24px 0 0;">Grace and peace,<br /><strong>The Wisdom Church Team</strong></p>`
);

const DEFAULT_TEXT_TEMPLATE = `Hello {{ .FirstName }},

We are reaching out with a new update from The Wisdom Church. Thank you for staying connected with the house.

Grace and peace,
The Wisdom Church Team

Unsubscribe: {{ .UnsubscribeURL }}`;

const TEMPLATE_PRESETS = [
  { id: 'church-update', label: 'Church Update', subject: 'A New Update from The Wisdom Church', html: DEFAULT_HTML_TEMPLATE, text: DEFAULT_TEXT_TEMPLATE },
  {
    id: 'event-reminder',
    label: 'Event Reminder',
    subject: 'Reminder: Upcoming Church Activity',
    html: buildEmailHTML(
      'You are warmly invited',
      `<p style="margin:0 0 16px;">Hello {{ .FirstName }},</p><p style="margin:0 0 16px;">This is a kind reminder about an upcoming church activity. We would love to have you join us.</p><p style="margin:24px 0 0;">God bless you,<br /><strong>The Wisdom Church Team</strong></p>`
    ),
    text: `Hello {{ .FirstName }},\n\nThis is a kind reminder about an upcoming church activity. We would love to have you join us.\n\nGod bless you,\nThe Wisdom Church Team\n\nUnsubscribe: {{ .UnsubscribeURL }}`,
  },
  {
    id: 'follow-up',
    label: 'Follow-up',
    subject: 'Thank You for Connecting with The Wisdom Church',
    html: buildEmailHTML(
      'Thank you for connecting with us',
      `<p style="margin:0 0 16px;">Hello {{ .FirstName }},</p><p style="margin:0 0 16px;">Thank you for recently connecting with The Wisdom Church. We look forward to staying in touch with you.</p><p style="margin:24px 0 0;">With love,<br /><strong>The Wisdom Church Team</strong></p>`
    ),
    text: `Hello {{ .FirstName }},\n\nThank you for recently connecting with The Wisdom Church. We look forward to staying in touch with you.\n\nWith love,\nThe Wisdom Church Team\n\nUnsubscribe: {{ .UnsubscribeURL }}`,
  },
];

const numberFormatter = new Intl.NumberFormat('en-US');
function formatNumber(value: number): string { return numberFormatter.format(value); }
function formatDate(value?: string): string {
  if (!value) return 'No date';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
function formatDateTime(value?: string): string {
  if (!value) return 'No timestamp';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function parseManualRecipients(raw: string): AdminEmailRecipientInput[] {
  const chunks = raw.split(/\n|,|;/).map((item) => item.trim()).filter(Boolean);
  const recipients: AdminEmailRecipientInput[] = [];
  const seen = new Set<string>();
  chunks.forEach((chunk) => {
    const angled = chunk.match(/^(.*?)<([^<>@\s]+@[^<>@\s]+\.[^<>@\s]+)>$/);
    const email = angled ? angled[2].trim().toLowerCase() : chunk.trim().toLowerCase();
    const name = angled ? angled[1].trim().replace(/^"|"$/g, '') : '';
    if (!email.includes('@') || seen.has(email)) return;
    seen.add(email);
    recipients.push(name ? { name, email } : { email });
  });
  return recipients;
}

function renderPreviewHtml(html: string): string {
  return html
    .replaceAll('{{ .FirstName }}', 'John')
    .replaceAll('{{.FirstName}}', 'John')
    .replaceAll('{{ .Email }}', 'john@example.com')
    .replaceAll('{{.Email}}', 'john@example.com')
    .replaceAll('{{ .UnsubscribeURL }}', '#unsubscribe')
    .replaceAll('{{.UnsubscribeURL}}', '#unsubscribe');
}

function getHistoryDate(item: AdminEmailDeliveryHistoryItem): string | undefined {
  const withDates = item as AdminEmailDeliveryHistoryItem & { createdAt?: string; created_at?: string; sentAt?: string; sent_at?: string };
  return withDates.createdAt ?? withDates.created_at ?? withDates.sentAt ?? withDates.sent_at;
}

// Mirrors internal/email.MaxAttachmentBytes / MaxTotalAttachmentBytes on the
// backend — enforced client-side too so a rejected upload fails fast instead
// of only surfacing at send time.
const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const MAX_ATTACHMENTS = 10;
const MAX_EFLIER_BYTES = 8 * 1024 * 1024;

interface ComposeAttachment {
  url: string;
  filename: string;
  sizeBytes: number;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type WizardStep = 1 | 2 | 3;
const WIZARD_STEPS: { id: WizardStep; label: string; description: string }[] = [
  { id: 1, label: 'Audience', description: 'Forms and manual recipients' },
  { id: 2, label: 'Compose', description: 'Subject, attachments, body' },
  { id: 3, label: 'Preview & send', description: 'Review the rendered email' },
];

function SummaryCard({ label, value, hint, icon: Icon }: { label: string; value: number | string; hint: string; icon: React.ElementType }) {
  return <article className={styles.summaryCard}><div className={styles.summaryIcon}><Icon className="h-5 w-5" /></div><span>{label}</span><strong>{value}</strong><p>{hint}</p></article>;
}

function StatusChip({ status }: { status: string }) {
  return <span className={styles.statusChip} data-status={status.toLowerCase()}>{status}</span>;
}

function EmailMarketingPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [page, setPage] = useState(1);

  const [summary, setSummary] = useState<AdminEmailMarketingSummary | null>(null);
  const [forms, setForms] = useState<AdminEmailMarketingFormItem[]>([]);
  const [formTotal, setFormTotal] = useState(0);
  const [formTotalPages, setFormTotalPages] = useState(1);
  const [history, setHistory] = useState<AdminEmailDeliveryHistoryItem[]>([]);
  const [selectedFormIds, setSelectedFormIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<AdminEmailAudiencePreview | null>(null);

  const [subject, setSubject] = useState('A New Update from The Wisdom Church');
  const [htmlBody, setHtmlBody] = useState(DEFAULT_HTML_TEMPLATE);
  const [textBody, setTextBody] = useState(DEFAULT_TEXT_TEMPLATE);
  const [manualRecipientsRaw, setManualRecipientsRaw] = useState('');
  const [formSearch, setFormSearch] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState('church-update');
  const [editorMode, setEditorMode] = useState<'html' | 'text'>('html');
  const [lastResult, setLastResult] = useState<SendAdminComposeEmailResponse | null>(null);
  const [attachments, setAttachments] = useState<ComposeAttachment[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [eflierUrl, setEflierUrl] = useState<string | null>(null);
  const [eflierFilename, setEflierFilename] = useState('');
  const [uploadingEflier, setUploadingEflier] = useState(false);
  const [step, setStep] = useState<WizardStep>(1);
  const [historyOpen, setHistoryOpen] = useState(false);
  const hasLoadedRef = useRef(false);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const eflierInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    async function loadWorkspace() {
      if (hasLoadedRef.current) setRefreshing(true); else setLoading(true);
      try {
        const [summaryData, formData, historyData] = await Promise.all([
          apiClient.getEmailMarketingSummary(),
          apiClient.listEmailMarketingForms({ page, limit: 8 }),
          apiClient.listAdminComposeHistory({ page: 1, limit: 8 }),
        ]);
        if (!active) return;
        setSummary(summaryData);
        setForms(formData.data);
        setFormTotal(formData.total);
        setFormTotalPages(Math.max(1, formData.totalPages));
        setHistory(historyData.data);
      } catch (error) {
        if (active) toast.error(getServerErrorMessage(error, 'Failed to load email marketing workspace.'));
      } finally {
        if (active) { setLoading(false); setRefreshing(false); hasLoadedRef.current = true; }
      }
    }
    void loadWorkspace();
    return () => { active = false; };
  }, [page, refreshKey]);

  useEffect(() => {
    let active = true;
    async function loadPreview() {
      if (selectedFormIds.length === 0) { setPreview(null); return; }
      setPreviewLoading(true);
      try {
        const data = await apiClient.previewEmailMarketingAudience(selectedFormIds, 18);
        if (active) setPreview(data);
      } catch (error) {
        if (active) toast.error(getServerErrorMessage(error, 'Failed to load audience preview.'));
      } finally {
        if (active) setPreviewLoading(false);
      }
    }
    void loadPreview();
    return () => { active = false; };
  }, [selectedFormIds]);

  const parsedManualRecipients = useMemo(() => parseManualRecipients(manualRecipientsRaw), [manualRecipientsRaw]);
  const filteredForms = useMemo(() => {
    const query = formSearch.trim().toLowerCase();
    if (!query) return forms;
    return forms.filter((form) => `${form.formTitle} ${form.isPublished ? 'published live' : 'draft'} ${form.uniqueRecipients} ${form.validRecipients}`.toLowerCase().includes(query));
  }, [formSearch, forms]);

  const selectedCurrentPageCount = forms.filter((form) => selectedFormIds.includes(form.formId)).length;
  const currentPageAllSelected = forms.length > 0 && forms.every((form) => selectedFormIds.includes(form.formId));
  const estimatedReach = (preview?.uniqueRecipients ?? 0) + parsedManualRecipients.length;

  // The wizard's step pills visually imply a linear, validated flow — make
  // that real instead of cosmetic: a step can only be reached once every
  // step before it actually has the minimum data `handleSendCampaign` will
  // require at send time.
  function isStepComplete(target: WizardStep): boolean {
    if (target === 1) return selectedFormIds.length > 0 || parsedManualRecipients.length > 0;
    if (target === 2) return subject.trim().length > 0 && htmlBody.trim().length > 0;
    return true;
  }
  const maxReachableStep: WizardStep = !isStepComplete(1) ? 1 : !isStepComplete(2) ? 2 : 3;

  function goToStep(target: WizardStep) {
    if (target > maxReachableStep) {
      toast.error(target === 3 ? 'Add a subject and message body before previewing.' : 'Select an audience before continuing.');
      return;
    }
    setStep(target);
  }

  function toggleForm(formId: string) {
    setSelectedFormIds((current) => current.includes(formId) ? current.filter((item) => item !== formId) : [...current, formId]);
  }

  function toggleCurrentPage() {
    setSelectedFormIds((current) => {
      const next = new Set(current);
      if (currentPageAllSelected) forms.forEach((form) => next.delete(form.formId)); else forms.forEach((form) => next.add(form.formId));
      return Array.from(next);
    });
  }

  function useTopAudiences() {
    const suggested = (summary?.topForms ?? []).slice(0, 3).map((item) => item.formId);
    if (suggested.length === 0) { toast.error('No top audience forms are available yet.'); return; }
    setSelectedFormIds(suggested);
    toast.success('Top audiences selected.');
  }

  function clearAudience() {
    setSelectedFormIds([]);
    setManualRecipientsRaw('');
    setPreview(null);
  }

  function applyPreset(presetId: string) {
    const preset = TEMPLATE_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    setSelectedPresetId(preset.id);
    setSubject(preset.subject);
    setHtmlBody(applyEflierToHtml(preset.html, eflierUrl));
    setTextBody(preset.text);
    toast.success(`${preset.label} template loaded.`);
  }

  async function handleEflierSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('The eflier must be an image file.');
      return;
    }
    if (file.size > MAX_EFLIER_BYTES) {
      toast.error(`The eflier image must be ${formatFileSize(MAX_EFLIER_BYTES)} or smaller.`);
      return;
    }

    setUploadingEflier(true);
    try {
      const uploaded = await apiClient.uploadAsset(file, { kind: 'image', module: 'email-marketing' });
      const url = uploaded.publicUrl || uploaded.public_url || uploaded.url;
      setEflierUrl(url);
      setEflierFilename(uploaded.originalName || file.name);
      setHtmlBody((current) => applyEflierToHtml(current, url));
      toast.success('Eflier added to the top of the email.');
    } catch (error) {
      toast.error(getServerErrorMessage(error, 'Failed to upload the eflier image.'));
    } finally {
      setUploadingEflier(false);
    }
  }

  function removeEflier() {
    setEflierUrl(null);
    setEflierFilename('');
    setHtmlBody((current) => applyEflierToHtml(current, null));
  }

  async function copyHtmlBody() {
    try { await navigator.clipboard.writeText(htmlBody); toast.success('HTML body copied.'); } catch { toast.error('Could not copy HTML body.'); }
  }

  const attachmentTotalBytes = attachments.reduce((sum, item) => sum + item.sizeBytes, 0);

  async function handleAttachmentSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;

    if (attachments.length + files.length > MAX_ATTACHMENTS) {
      toast.error(`A campaign email may have at most ${MAX_ATTACHMENTS} attachments.`);
      return;
    }

    setUploadingAttachment(true);
    let runningTotal = attachmentTotalBytes;
    try {
      for (const file of files) {
        if (file.size > MAX_ATTACHMENT_BYTES) {
          toast.error(`${file.name} is larger than ${formatFileSize(MAX_ATTACHMENT_BYTES)} and was skipped.`);
          continue;
        }
        if (runningTotal + file.size > MAX_TOTAL_ATTACHMENT_BYTES) {
          toast.error(`Adding ${file.name} would exceed the combined ${formatFileSize(MAX_TOTAL_ATTACHMENT_BYTES)} attachment limit.`);
          continue;
        }
        try {
          const uploaded = await apiClient.uploadAsset(file, { kind: 'file', module: 'email-marketing' });
          const url = uploaded.publicUrl || uploaded.public_url || uploaded.url;
          runningTotal += file.size;
          setAttachments((current) => [
            ...current,
            { url, filename: uploaded.originalName || file.name, sizeBytes: file.size },
          ]);
        } catch (error) {
          toast.error(getServerErrorMessage(error, `Failed to upload ${file.name}.`));
        }
      }
    } finally {
      setUploadingAttachment(false);
    }
  }

  function removeAttachment(url: string) {
    setAttachments((current) => current.filter((item) => item.url !== url));
  }

  async function handleSendCampaign() {
    if (selectedFormIds.length === 0 && parsedManualRecipients.length === 0) { toast.error('Select at least one form or add manual recipients.'); return; }
    if (!subject.trim()) { toast.error('Add a subject line before sending.'); return; }
    if (!htmlBody.trim()) { toast.error('Add the HTML body before sending.'); return; }

    setSending(true);
    try {
      const attachmentPayload: AdminEmailAttachmentInput[] = attachments.map((item) => ({
        url: item.url,
        filename: item.filename,
      }));
      const payload: SendAdminComposeEmailRequest = {
        subject: subject.trim(),
        htmlBody,
        textBody: textBody.trim() || undefined,
        manualRecipients: parsedManualRecipients.length > 0 ? parsedManualRecipients : undefined,
        formIds: selectedFormIds.length > 0 ? selectedFormIds : undefined,
        attachments: attachmentPayload.length > 0 ? attachmentPayload : undefined,
      };
      const result = await apiClient.sendAdminComposeEmail(payload);
      setLastResult(result);
      setAttachments([]);
      setRefreshKey((current) => current + 1);
      toast.success(`Campaign sent: ${result.sent} delivered, ${result.failed} failed.`);
    } catch (error) {
      toast.error(getServerErrorMessage(error, 'Failed to send campaign.'));
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return <div className={styles.loadingShell}><div className={styles.loadingCard}><div className={styles.loadingOrb} /><h1>Loading email marketing workspace</h1><p>Preparing audiences, composer, preview, and delivery history.</p></div></div>;
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <Link href="/dashboard" className={styles.backLink}><ArrowLeft className="h-4 w-4" />Back to dashboard</Link>
          <p className={styles.eyebrow}><MailCheck className="h-4 w-4" />Email Marketing Studio</p>
          <h1>Build campaigns from your form audiences.</h1>
          <p>Pick an audience, compose the message, then preview and send — one step at a time.</p>
          <div className={styles.heroActions}>
            <Button type="button" variant="ghost" onClick={() => setRefreshKey((current) => current + 1)} disabled={refreshing} icon={<RefreshCw className={refreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />}>{refreshing ? 'Refreshing...' : 'Refresh data'}</Button>
          </div>
        </div>
        <div className={styles.summaryGrid}>
          <SummaryCard icon={Users} label="Reachable contacts" value={formatNumber(summary?.reachableRecipients ?? 0)} hint="Unique emails across form audiences." />
          <SummaryCard icon={FileText} label="Tracked forms" value={formatNumber(summary?.totalForms ?? 0)} hint={`${formatNumber(summary?.publishedForms ?? 0)} live forms.`} />
          <SummaryCard icon={Send} label="Campaigns sent" value={formatNumber(Number(summary?.totalCampaigns ?? 0))} hint="Recent compose history stays visible." />
          <SummaryCard icon={Mail} label="Current reach" value={formatNumber(estimatedReach)} hint="Selected forms plus manual recipients." />
        </div>
      </section>

      <section className={styles.wizard}>
        <div className={styles.stepper}>
          {WIZARD_STEPS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={styles.stepButton}
              data-active={step === item.id}
              data-done={step > item.id}
              disabled={item.id > maxReachableStep}
              onClick={() => goToStep(item.id)}
            >
              <span className={styles.stepBadge}>{step > item.id ? <CheckCircle2 className="h-3.5 w-3.5" /> : item.id}</span>
              <span className={styles.stepText}><strong>{item.label}</strong><em>{item.description}</em></span>
            </button>
          ))}
        </div>

        <div className={styles.wizardSummary}>
          <span><em>Reach</em><strong>{formatNumber(estimatedReach)}</strong></span>
          <span><em>Subject</em><strong>{subject || 'Not set'}</strong></span>
          <span><em>Attachments</em><strong>{attachments.length}</strong></span>
          <span><em>Eflier</em><strong>{eflierUrl ? 'Added' : 'None'}</strong></span>
        </div>

        {step === 1 && (
          <div className={styles.stepPanel}>
            <div className={styles.audienceGrid}>
              <section className={styles.panel}>
                <div className={styles.panelHeader}><div><p>Audience source</p><h2>Recipient forms</h2><span>Select forms whose submitted emails should receive this campaign.</span></div><strong>{formatNumber(formTotal)}</strong></div>
                <div className={styles.searchBox}><Search className="h-4 w-4" /><input value={formSearch} onChange={(event) => setFormSearch(event.target.value)} placeholder="Search forms..." />{formSearch ? <button type="button" onClick={() => setFormSearch('')}><X className="h-4 w-4" /></button> : null}</div>
                <div className={styles.audienceActions}><Button type="button" variant="outline" onClick={toggleCurrentPage} disabled={forms.length === 0}>{currentPageAllSelected ? 'Unselect page' : 'Select page'}</Button><Button type="button" variant="ghost" onClick={useTopAudiences}>Top</Button><Button type="button" variant="ghost" onClick={clearAudience}>Clear</Button></div>
                <p className={styles.selectionHint}>{selectedFormIds.length} form{selectedFormIds.length === 1 ? '' : 's'} selected. {selectedCurrentPageCount > 0 ? `${selectedCurrentPageCount} selected here.` : ''}</p>
                <div className={styles.formList}>
                  {filteredForms.map((form) => {
                    const active = selectedFormIds.includes(form.formId);
                    return <button key={form.formId} type="button" className={styles.formCard} data-active={active} onClick={() => toggleForm(form.formId)}><div className={styles.formCardTop}><StatusChip status={form.isPublished ? 'live' : 'draft'} /><strong>{formatNumber(form.uniqueRecipients)}</strong></div><h3>{form.formTitle}</h3><p>{formatNumber(form.totalSubmissions)} submissions · {formatNumber(form.validRecipients)} valid emails</p><span>{form.lastSubmissionAt ? `Last response ${formatDate(form.lastSubmissionAt)}` : 'No responses yet'}</span></button>;
                  })}
                  {filteredForms.length === 0 ? <EmptyState icon={<FileText className="h-5 w-5" />} title="No forms found" description="Try another search term or refresh the workspace." /> : null}
                </div>
                <div className={styles.pagination}><Button type="button" variant="ghost" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft className="h-4 w-4" />Previous</Button><span>Page {page} of {formTotalPages}</span><Button type="button" variant="ghost" disabled={page >= formTotalPages} onClick={() => setPage((current) => Math.min(formTotalPages, current + 1))}>Next<ChevronRight className="h-4 w-4" /></Button></div>
              </section>

              <section className={styles.panel}>
                <div className={styles.panelHeader}><div><p>Manual contacts</p><h2>Add recipients by hand</h2><span>One per line, or paste a comma separated list.</span></div>{previewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}</div>
                <textarea className={styles.manualTextarea} value={manualRecipientsRaw} onChange={(event) => setManualRecipientsRaw(event.target.value)} placeholder={'person@example.com\nJane Doe <jane@example.com>'} />
                <div className={styles.previewStats}><article><span>Unique</span><strong>{formatNumber(preview?.uniqueRecipients ?? 0)}</strong></article><article><span>Valid</span><strong>{formatNumber(preview?.validRecipients ?? 0)}</strong></article><article><span>Skipped</span><strong>{formatNumber(preview?.skipped ?? 0)}</strong></article></div>
                {previewLoading ? <div className={styles.loadingInline}><Loader2 className="h-4 w-4 animate-spin" /><span>Building audience preview...</span></div> : preview ? <div className={styles.recipientList}>{preview.recipients.map((recipient) => <article key={recipient.email}><strong>{recipient.name || recipient.email}</strong>{recipient.name ? <span>{recipient.email}</span> : null}</article>)}</div> : <EmptyState icon={<Users className="h-5 w-5" />} title="No audience selected" description="Select forms to preview the collated audience." />}
              </section>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className={styles.stepPanel}>
            <section className={styles.composePanel}>
              <div className={styles.composeHeader}><div><p>Compose studio</p><h2>Campaign composer</h2><span>Subject, attachments, eflier banner, HTML body and text fallback.</span></div><div><Button type="button" variant="outline" onClick={copyHtmlBody} icon={<Copy className="h-4 w-4" />}>Copy HTML</Button></div></div>
              <div className={styles.composerBox}>
                <div className={styles.composerRow}><label htmlFor="campaign-subject">Subject</label><input id="campaign-subject" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Add a clear subject line" /></div>

                <div className={styles.attachmentBlock}>
                  <label>Attach</label>
                  <div className={styles.attachmentControls}>
                    <input ref={attachmentInputRef} type="file" multiple hidden onChange={handleAttachmentSelect} />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={styles.attachmentPickButton}
                      onClick={() => attachmentInputRef.current?.click()}
                      loading={uploadingAttachment}
                      disabled={attachments.length >= MAX_ATTACHMENTS}
                      icon={<Paperclip className="h-4 w-4" />}
                    >
                      {uploadingAttachment ? 'Uploading...' : 'Add images, files or documents'}
                    </Button>
                    {attachments.length > 0 && (
                      <div className={styles.attachmentList}>
                        {attachments.map((item) => (
                          <span key={item.url} className={styles.attachmentChip}>
                            <span title={item.filename}>{item.filename} ({formatFileSize(item.sizeBytes)})</span>
                            <button type="button" onClick={() => removeAttachment(item.url)} aria-label={`Remove ${item.filename}`}>
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <span className={styles.attachmentHint}>
                      Up to {MAX_ATTACHMENTS} files, {formatFileSize(MAX_ATTACHMENT_BYTES)} each, {formatFileSize(MAX_TOTAL_ATTACHMENT_BYTES)} combined.
                    </span>
                  </div>
                </div>

                <div className={styles.attachmentBlock}>
                  <label>Eflier</label>
                  <div className={styles.attachmentControls}>
                    <input ref={eflierInputRef} type="file" accept="image/*" hidden onChange={handleEflierSelect} />
                    {eflierUrl ? (
                      <div className={styles.eflierPreview}>
                        {/* eslint-disable-next-line @next/next/no-img-element -- remote church-flyer upload, no next/image loader configured for this bucket */}
                        <img src={eflierUrl} alt="Eflier banner preview" />
                        <div>
                          <span title={eflierFilename}>{eflierFilename}</span>
                          <button type="button" onClick={removeEflier}><X className="h-3 w-3" />Remove</button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={styles.attachmentPickButton}
                        onClick={() => eflierInputRef.current?.click()}
                        loading={uploadingEflier}
                        icon={<ImageIcon className="h-4 w-4" />}
                      >
                        {uploadingEflier ? 'Uploading...' : 'Add a church eflier banner'}
                      </Button>
                    )}
                    <span className={styles.attachmentHint}>
                      Appears as a full-width banner at the very top of the email, above the church header.
                    </span>
                  </div>
                </div>

                <div className={styles.templateBar}><div>{TEMPLATE_PRESETS.map((preset) => <button key={preset.id} type="button" data-active={selectedPresetId === preset.id} onClick={() => applyPreset(preset.id)}>{preset.label}</button>)}</div><div><button type="button" data-active={editorMode === 'html'} onClick={() => setEditorMode('html')}>HTML</button><button type="button" data-active={editorMode === 'text'} onClick={() => setEditorMode('text')}>Text</button></div></div>
                <div className={styles.tokenRow}>{['{{ .FirstName }}', '{{ .Email }}', '{{ .UnsubscribeURL }}'].map((token) => <button key={token} type="button" onClick={() => editorMode === 'html' ? setHtmlBody((current) => `${current}\n${token}`) : setTextBody((current) => `${current}\n${token}`)}>{token}</button>)}</div>
                <textarea className={styles.codeEditor} value={editorMode === 'html' ? htmlBody : textBody} onChange={(event) => editorMode === 'html' ? setHtmlBody(event.target.value) : setTextBody(event.target.value)} spellCheck={false} />
              </div>
            </section>
          </div>
        )}

        {step === 3 && (
          <div className={styles.stepPanel}>
            <section className={styles.previewPanel}>
              <div className={styles.panelHeader}><div><p>Live email</p><h2>Rendered preview</h2><span>Sample merge tags are replaced for preview only.</span></div><Eye className="h-4 w-4" /></div>
              {lastResult ? <div className={styles.resultBanner}><CheckCircle2 className="h-4 w-4" /><span>Delivered {formatNumber(lastResult.sent)}, skipped {formatNumber(lastResult.skipped)}, failed {formatNumber(lastResult.failed)}.</span></div> : null}
              <div className={styles.recapChips}>
                <span>{formatNumber(estimatedReach)} recipient{estimatedReach === 1 ? '' : 's'}</span>
                <span>{attachments.length} attachment{attachments.length === 1 ? '' : 's'}</span>
                <span>{eflierUrl ? 'Eflier included' : 'No eflier'}</span>
              </div>
              <div className={styles.previewFrame}><div><span>Subject</span><strong>{subject || 'No subject'}</strong></div><div className={styles.previewCanvas} dangerouslySetInnerHTML={{ __html: renderPreviewHtml(htmlBody) }} /></div>
              <div className={styles.sendRow}><p>Overlapping recipients are deduplicated before delivery.</p><Button type="button" onClick={handleSendCampaign} loading={sending} icon={<Send className="h-4 w-4" />}>Send campaign</Button></div>
            </section>
          </div>
        )}

        <div className={styles.stepNav}>
          <Button type="button" variant="ghost" onClick={() => setStep((current) => (Math.max(1, current - 1) as WizardStep))} disabled={step === 1} icon={<ChevronLeft className="h-4 w-4" />}>Back</Button>
          {!isStepComplete(step) ? (
            <span className={styles.stepNavHint}>
              {step === 1 ? 'Select a form audience or add a manual recipient to continue.' : 'Add a subject and message body to continue.'}
            </span>
          ) : null}
          {step < 3 ? (
            <Button type="button" onClick={() => goToStep((step + 1) as WizardStep)} disabled={!isStepComplete(step)} icon={<ChevronRight className="h-4 w-4" />}>Next</Button>
          ) : (
            <Button type="button" onClick={handleSendCampaign} loading={sending} icon={<Send className="h-4 w-4" />}>Send campaign</Button>
          )}
        </div>
      </section>

      <section className={styles.historySection}>
        <button type="button" className={styles.historyToggle} onClick={() => setHistoryOpen((current) => !current)}>
          <Clock3 className="h-4 w-4" />
          <span>Recent campaigns ({formatNumber(history.length)})</span>
          <ChevronDown className={styles.historyChevron} data-open={historyOpen} />
        </button>
        {historyOpen ? (
          history.length > 0 ? (
            <div className={styles.historyList}>
              {history.map((item) => <article key={item.id}><div><strong>{item.subject}</strong><p>{formatNumber(item.targeted)} targeted · {formatNumber(item.sent)} sent · {formatNumber(item.failed)} failed</p><span>{formatDateTime(getHistoryDate(item))}</span></div><StatusChip status={item.status} /></article>)}
            </div>
          ) : (
            <EmptyState icon={<Mail className="h-5 w-5" />} title="No campaigns yet" description="Sent campaigns appear here after delivery." />
          )
        ) : null}
      </section>
    </main>
  );
}

export default withAuth(EmailMarketingPage, { requiredRole: 'admin' });
