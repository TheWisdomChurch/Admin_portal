'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Eye,
  FileText,
  Inbox,
  Loader2,
  Mail,
  MailCheck,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { apiClient } from '@/lib/api';
import { getServerErrorMessage } from '@/lib/serverValidation';
import type {
  AdminEmailAudiencePreview,
  AdminEmailDeliveryHistoryItem,
  AdminEmailMarketingFormItem,
  AdminEmailMarketingSummary,
  AdminEmailRecipientInput,
  SendAdminComposeEmailRequest,
  SendAdminComposeEmailResponse,
} from '@/lib/types';
import { Button } from '@/ui/Button';

import styles from './email-marketing.module.scss';

const EMAIL_BRAND_HEADER = `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr><td style="vertical-align:middle;padding:0 18px 0 0;"><img src="https://admin.wisdomchurchhq.org/OIP.webp" alt="The Wisdom Church logo" width="54" height="54" style="display:block;width:54px;height:54px;object-fit:cover;border-radius:16px;border:1px solid #e5e7eb;background:#ffffff;" /></td><td style="width:1px;background:#f8fafc;padding:0;"></td><td style="vertical-align:middle;padding:0 0 0 18px;"><div style="font-size:11px;line-height:1.05;font-weight:900;letter-spacing:.18em;color:#ffffff;text-transform:uppercase;"><div>THE</div><div style="margin-top:3px;">WISDOM</div><div style="margin-top:3px;">CHURCH</div></div></td></tr></table>`;

const DEFAULT_HTML_TEMPLATE = `<section style="font-family:Arial,sans-serif;color:#111827;line-height:1.7;background:#ffffff;">
  <div style="max-width:620px;margin:0 auto;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden;">
    <div style="background:#111827;padding:26px 28px;">
      ${EMAIL_BRAND_HEADER}
      <h1 style="margin:22px 0 0;color:#ffffff;font-size:28px;line-height:1.25;">A timely update for you</h1>
    </div>
    <div style="padding:28px;">
      <p style="margin:0 0 16px;">Hello {{ .FirstName }},</p>
      <p style="margin:0 0 16px;">We are reaching out with a new update from The Wisdom Church. Thank you for staying connected with the house.</p>
      <p style="margin:24px 0 0;">Grace and peace,<br /><strong>The Wisdom Church Team</strong></p>
      <p style="margin:28px 0 0;font-size:12px;color:#6b7280;">Prefer not to receive these emails? <a href="{{ .UnsubscribeURL }}" style="color:#111827;font-weight:700;">Unsubscribe here</a>.</p>
    </div>
  </div>
</section>`;

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
    html: `<section style="font-family:Arial,sans-serif;color:#111827;line-height:1.7;"><div style="max-width:620px;margin:0 auto;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden;"><div style="background:#111827;padding:26px 28px;">${EMAIL_BRAND_HEADER}<h1 style="margin:22px 0 0;color:#ffffff;font-size:28px;line-height:1.25;">You are warmly invited</h1></div><div style="padding:28px;"><p>Hello {{ .FirstName }},</p><p>This is a kind reminder about an upcoming church activity. We would love to have you join us.</p><p>God bless you,<br /><strong>The Wisdom Church Team</strong></p><p style="font-size:12px;color:#6b7280;">Unsubscribe: <a href="{{ .UnsubscribeURL }}">link</a></p></div></div></section>`,
    text: `Hello {{ .FirstName }},\n\nThis is a kind reminder about an upcoming church activity. We would love to have you join us.\n\nGod bless you,\nThe Wisdom Church Team\n\nUnsubscribe: {{ .UnsubscribeURL }}`,
  },
  {
    id: 'follow-up',
    label: 'Follow-up',
    subject: 'Thank You for Connecting with The Wisdom Church',
    html: `<section style="font-family:Arial,sans-serif;color:#111827;line-height:1.7;"><div style="max-width:620px;margin:0 auto;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden;"><div style="background:#111827;padding:26px 28px;">${EMAIL_BRAND_HEADER}<h1 style="margin:22px 0 0;color:#ffffff;font-size:28px;line-height:1.25;">Thank you for connecting with us</h1></div><div style="padding:28px;"><p>Hello {{ .FirstName }},</p><p>Thank you for recently connecting with The Wisdom Church. We look forward to staying in touch with you.</p><p>With love,<br /><strong>The Wisdom Church Team</strong></p><p style="font-size:12px;color:#6b7280;">Unsubscribe: <a href="{{ .UnsubscribeURL }}">link</a></p></div></div></section>`,
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

function SummaryCard({ label, value, hint, icon: Icon }: { label: string; value: number | string; hint: string; icon: React.ElementType }) {
  return <article className={styles.summaryCard}><div className={styles.summaryIcon}><Icon className="h-5 w-5" /></div><span>{label}</span><strong>{value}</strong><p>{hint}</p></article>;
}

function EmptyState({ icon: Icon = Inbox, title, description }: { icon?: React.ElementType; title: string; description: string }) {
  return <div className={styles.emptyState}><div><Icon className="h-5 w-5" /></div><strong>{title}</strong><p>{description}</p></div>;
}

function StatusChip({ status }: { status: string }) {
  return <span className={styles.statusChip} data-status={status.toLowerCase()}>{status}</span>;
}

export default function EmailMarketingPage() {
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
  const hasLoadedRef = useRef(false);

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
    setHtmlBody(preset.html);
    setTextBody(preset.text);
    toast.success(`${preset.label} template loaded.`);
  }

  async function copyHtmlBody() {
    try { await navigator.clipboard.writeText(htmlBody); toast.success('HTML body copied.'); } catch { toast.error('Could not copy HTML body.'); }
  }

  async function handleSendCampaign() {
    if (selectedFormIds.length === 0 && parsedManualRecipients.length === 0) { toast.error('Select at least one form or add manual recipients.'); return; }
    if (!subject.trim()) { toast.error('Add a subject line before sending.'); return; }
    if (!htmlBody.trim()) { toast.error('Add the HTML body before sending.'); return; }

    setSending(true);
    try {
      const payload: SendAdminComposeEmailRequest = {
        subject: subject.trim(),
        htmlBody,
        textBody: textBody.trim() || undefined,
        manualRecipients: parsedManualRecipients.length > 0 ? parsedManualRecipients : undefined,
        formIds: selectedFormIds.length > 0 ? selectedFormIds : undefined,
      };
      const result = await apiClient.sendAdminComposeEmail(payload);
      setLastResult(result);
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
          <p>Deduplicate recipients, add manual contacts, compose the message, preview it, and send through your backend.</p>
          <div className={styles.heroActions}>
            <Button type="button" onClick={useTopAudiences} icon={<Sparkles className="h-4 w-4" />}>Use top audiences</Button>
            <Button type="button" variant="outline" onClick={() => applyPreset('church-update')}>Load template</Button>
            <Button type="button" variant="ghost" onClick={() => setRefreshKey((current) => current + 1)} disabled={refreshing} icon={<RefreshCw className={refreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />}>{refreshing ? 'Refreshing...' : 'Refresh data'}</Button>
          </div>
        </div>
        <div className={styles.summaryGrid}>
          <SummaryCard icon={Users} label="Reachable contacts" value={formatNumber(summary?.reachableRecipients ?? 0)} hint="Unique emails across form audiences." />
          <SummaryCard icon={FileText} label="Tracked forms" value={formatNumber(summary?.totalForms ?? 0)} hint={`${formatNumber(summary?.publishedForms ?? 0)} published forms.`} />
          <SummaryCard icon={Send} label="Campaigns sent" value={formatNumber(Number(summary?.totalCampaigns ?? 0))} hint="Recent compose history stays visible." />
          <SummaryCard icon={Mail} label="Current reach" value={formatNumber(estimatedReach)} hint="Selected forms plus manual recipients." />
        </div>
      </section>

      <section className={styles.layout}>
        <aside className={styles.sidePanel}>
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
              {filteredForms.length === 0 ? <EmptyState icon={FileText} title="No forms found" description="Try another search term or refresh the workspace." /> : null}
            </div>
            <div className={styles.pagination}><Button type="button" variant="ghost" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft className="h-4 w-4" />Previous</Button><span>Page {page} of {formTotalPages}</span><Button type="button" variant="ghost" disabled={page >= formTotalPages} onClick={() => setPage((current) => Math.min(formTotalPages, current + 1))}>Next<ChevronRight className="h-4 w-4" /></Button></div>
          </section>
        </aside>

        <section className={styles.composePanel}>
          <div className={styles.composeHeader}><div><p>Compose studio</p><h2>Campaign composer</h2><span>Recipients, subject, templates, HTML body, text fallback, and preview.</span></div><div><Button type="button" variant="outline" onClick={copyHtmlBody} icon={<Copy className="h-4 w-4" />}>Copy HTML</Button><Button type="button" onClick={handleSendCampaign} loading={sending} icon={<Send className="h-4 w-4" />}>Send</Button></div></div>
          {lastResult ? <div className={styles.resultBanner}><CheckCircle2 className="h-4 w-4" /><span>Delivered {formatNumber(lastResult.sent)}, skipped {formatNumber(lastResult.skipped)}, failed {formatNumber(lastResult.failed)}.</span></div> : null}
          <div className={styles.composerBox}>
            <div className={styles.composerRow}><label>To</label><div>{estimatedReach > 0 ? <strong>Estimated reach: {formatNumber(estimatedReach)}</strong> : <em>Select forms or add manual recipients.</em>}</div></div>
            <div className={styles.composerRow}><label htmlFor="campaign-subject">Subject</label><input id="campaign-subject" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Add a clear subject line" /></div>
            <div className={styles.manualBlock}><label htmlFor="manual-recipients">Manual</label><textarea id="manual-recipients" value={manualRecipientsRaw} onChange={(event) => setManualRecipientsRaw(event.target.value)} placeholder={'person@example.com\nJane Doe <jane@example.com>'} /></div>
            <div className={styles.templateBar}><div>{TEMPLATE_PRESETS.map((preset) => <button key={preset.id} type="button" data-active={selectedPresetId === preset.id} onClick={() => applyPreset(preset.id)}>{preset.label}</button>)}</div><div><button type="button" data-active={editorMode === 'html'} onClick={() => setEditorMode('html')}>HTML</button><button type="button" data-active={editorMode === 'text'} onClick={() => setEditorMode('text')}>Text</button></div></div>
            <div className={styles.tokenRow}>{['{{ .FirstName }}', '{{ .Email }}', '{{ .UnsubscribeURL }}'].map((token) => <button key={token} type="button" onClick={() => editorMode === 'html' ? setHtmlBody((current) => `${current}\n${token}`) : setTextBody((current) => `${current}\n${token}`)}>{token}</button>)}</div>
            <textarea className={styles.codeEditor} value={editorMode === 'html' ? htmlBody : textBody} onChange={(event) => editorMode === 'html' ? setHtmlBody(event.target.value) : setTextBody(event.target.value)} spellCheck={false} />
          </div>
          <div className={styles.sendRow}><p>The backend deduplicates overlapping recipients before delivery.</p><Button type="button" onClick={handleSendCampaign} loading={sending} icon={<Send className="h-4 w-4" />}>Send campaign</Button></div>
        </section>

        <aside className={styles.sidePanel}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}><div><p>Audience preview</p><h2>Deduplicated recipients</h2><span>Confirm delivery health before sending.</span></div>{previewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}</div>
            <div className={styles.previewStats}><article><span>Unique</span><strong>{formatNumber(preview?.uniqueRecipients ?? 0)}</strong></article><article><span>Valid</span><strong>{formatNumber(preview?.validRecipients ?? 0)}</strong></article><article><span>Skipped</span><strong>{formatNumber(preview?.skipped ?? 0)}</strong></article></div>
            {previewLoading ? <div className={styles.loadingInline}><Loader2 className="h-4 w-4 animate-spin" /><span>Building audience preview...</span></div> : preview ? <div className={styles.recipientList}>{preview.recipients.map((recipient) => <article key={recipient.email}><strong>{recipient.name || recipient.email}</strong>{recipient.name ? <span>{recipient.email}</span> : null}</article>)}</div> : <EmptyState icon={Users} title="No audience selected" description="Select forms to preview the collated audience." />}
          </section>
          <section className={styles.previewPanel}><div className={styles.panelHeader}><div><p>Live email</p><h2>Rendered preview</h2><span>Sample merge tags are replaced for preview only.</span></div><Eye className="h-4 w-4" /></div><div className={styles.previewFrame}><div><span>Subject</span><strong>{subject || 'No subject'}</strong></div><div className={styles.previewCanvas} dangerouslySetInnerHTML={{ __html: renderPreviewHtml(htmlBody) }} /></div></section>
          <section className={styles.panel}><div className={styles.panelHeader}><div><p>History</p><h2>Recent campaigns</h2><span>Latest delivery records.</span></div><Clock3 className="h-4 w-4" /></div>{history.length > 0 ? <div className={styles.historyList}>{history.map((item) => <article key={item.id}><div><strong>{item.subject}</strong><p>{formatNumber(item.targeted)} targeted · {formatNumber(item.sent)} sent · {formatNumber(item.failed)} failed</p><span>{formatDateTime(getHistoryDate(item))}</span></div><StatusChip status={item.status} /></article>)}</div> : <EmptyState icon={Mail} title="No campaigns yet" description="Sent campaigns appear here after delivery." />}</section>
        </aside>
      </section>
    </main>
  );
}
