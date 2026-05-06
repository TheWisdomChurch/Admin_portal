'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  LayoutTemplate,
  Loader2,
  Mail,
  MailCheck,
  MousePointerClick,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
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

const DEFAULT_HTML_TEMPLATE = `<section style="font-family: Arial, sans-serif; color: #111827; line-height: 1.7; background: #ffffff;">
  <div style="max-width: 620px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 18px; overflow: hidden;">
    <div style="background: #111827; padding: 26px 28px;">
      <p style="margin: 0; color: #facc15; font-size: 12px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase;">The Wisdom Church</p>
      <h1 style="margin: 10px 0 0; color: #ffffff; font-size: 28px; line-height: 1.25;">A timely update for you</h1>
    </div>

    <div style="padding: 28px;">
      <p style="margin: 0 0 16px;">Hello {{ .FirstName }},</p>

      <p style="margin: 0 0 16px;">
        We are reaching out with a new update from The Wisdom Church. Thank you for staying connected with the house and for being part of what God is doing in this season.
      </p>

      <p style="margin: 0 0 16px;">
        Please take a moment to read this message carefully and watch out for the next announcement from the church team.
      </p>

      <div style="margin: 24px 0; padding: 18px; background: #fffbeb; border-left: 4px solid #facc15; border-radius: 12px;">
        <p style="margin: 0; color: #374151;">
          We pray that your faith is strengthened and your heart remains encouraged in Christ.
        </p>
      </div>

      <p style="margin: 24px 0 0;">Grace and peace,<br /><strong>The Wisdom Church Team</strong></p>

      <p style="margin: 28px 0 0; font-size: 12px; color: #6b7280;">
        Prefer not to receive these emails? <a href="{{ .UnsubscribeURL }}" style="color:#111827; font-weight:700;">Unsubscribe here</a>.
      </p>
    </div>
  </div>
</section>`;

const DEFAULT_TEXT_TEMPLATE = `Hello {{ .FirstName }},

We are reaching out with a new update from The Wisdom Church. Thank you for staying connected with the house and for being part of what God is doing in this season.

Please take a moment to read this message carefully and watch out for the next announcement from the church team.

Grace and peace,
The Wisdom Church Team

Unsubscribe: {{ .UnsubscribeURL }}`;

const TEMPLATE_PRESETS = [
  {
    id: 'church-update',
    label: 'Church Update',
    subject: 'A New Update from The Wisdom Church',
    description: 'General church announcement for members, guests, and form audiences.',
    html: DEFAULT_HTML_TEMPLATE,
    text: DEFAULT_TEXT_TEMPLATE,
  },
  {
    id: 'event-reminder',
    label: 'Event Reminder',
    subject: 'Reminder: Upcoming Church Activity',
    description: 'Use this when you want to remind people about an upcoming event.',
    html: `<section style="font-family: Arial, sans-serif; color: #111827; line-height: 1.7;">
  <div style="max-width: 620px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 18px; overflow: hidden;">
    <div style="background:#111827;padding:26px 28px;">
      <p style="margin:0;color:#facc15;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;">The Wisdom Church</p>
      <h1 style="margin:10px 0 0;color:#ffffff;font-size:28px;line-height:1.25;">You are warmly invited</h1>
    </div>
    <div style="padding:28px;">
      <p style="margin:0 0 16px;">Hello {{ .FirstName }},</p>
      <p style="margin:0 0 16px;">This is a kind reminder about an upcoming church activity. We would love to have you join us as we gather in faith, fellowship, worship, and the Word.</p>
      <p style="margin:0 0 16px;">Please save the date, invite someone, and come expectant.</p>
      <p style="margin:24px 0 0;">God bless you,<br /><strong>The Wisdom Church Team</strong></p>
      <p style="margin:28px 0 0;font-size:12px;color:#6b7280;">Prefer not to receive these emails? <a href="{{ .UnsubscribeURL }}" style="color:#111827;font-weight:700;">Unsubscribe here</a>.</p>
    </div>
  </div>
</section>`,
    text: `Hello {{ .FirstName }},

This is a kind reminder about an upcoming church activity. We would love to have you join us as we gather in faith, fellowship, worship, and the Word.

Please save the date, invite someone, and come expectant.

God bless you,
The Wisdom Church Team

Unsubscribe: {{ .UnsubscribeURL }}`,
  },
  {
    id: 'follow-up',
    label: 'Follow-up',
    subject: 'Thank You for Connecting with The Wisdom Church',
    description: 'A warm follow-up for people who recently submitted a form.',
    html: `<section style="font-family: Arial, sans-serif; color: #111827; line-height: 1.7;">
  <div style="max-width: 620px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 18px; overflow: hidden;">
    <div style="background:#111827;padding:26px 28px;">
      <p style="margin:0;color:#facc15;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;">The Wisdom Church</p>
      <h1 style="margin:10px 0 0;color:#ffffff;font-size:28px;line-height:1.25;">Thank you for connecting with us</h1>
    </div>
    <div style="padding:28px;">
      <p style="margin:0 0 16px;">Hello {{ .FirstName }},</p>
      <p style="margin:0 0 16px;">Thank you for recently connecting with The Wisdom Church. We are glad to have your details and we look forward to staying in touch with you.</p>
      <p style="margin:0 0 16px;">Our prayer is that you continue to grow in grace, faith, wisdom, and purpose.</p>
      <p style="margin:24px 0 0;">With love,<br /><strong>The Wisdom Church Team</strong></p>
      <p style="margin:28px 0 0;font-size:12px;color:#6b7280;">Prefer not to receive these emails? <a href="{{ .UnsubscribeURL }}" style="color:#111827;font-weight:700;">Unsubscribe here</a>.</p>
    </div>
  </div>
</section>`,
    text: `Hello {{ .FirstName }},

Thank you for recently connecting with The Wisdom Church. We are glad to have your details and we look forward to staying in touch with you.

Our prayer is that you continue to grow in grace, faith, wisdom, and purpose.

With love,
The Wisdom Church Team

Unsubscribe: {{ .UnsubscribeURL }}`,
  },
];

const numberFormatter = new Intl.NumberFormat('en-US');

function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

function formatDate(value?: string): string {
  if (!value) return 'No date';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(value?: string): string {
  if (!value) return 'No timestamp';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function parseManualRecipients(raw: string): AdminEmailRecipientInput[] {
  const chunks = raw
    .split(/\n|,|;/)
    .map((item) => item.trim())
    .filter(Boolean);

  const recipients: AdminEmailRecipientInput[] = [];
  const seen = new Set<string>();

  chunks.forEach((chunk) => {
    const angled = chunk.match(/^(.*?)<([^<>@\s]+@[^<>@\s]+\.[^<>@\s]+)>$/);
    const email = angled ? angled[2].trim().toLowerCase() : chunk.trim().toLowerCase();
    const name = angled ? angled[1].trim().replace(/^"|"$/g, '') : '';

    if (!email.includes('@') || seen.has(email)) return;

    seen.add(email);
    if (name) {
      recipients.push({ name, email });
      return;
    }

    recipients.push({ email });
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
  const withDates = item as AdminEmailDeliveryHistoryItem & {
    createdAt?: string;
    created_at?: string;
    sentAt?: string;
    sent_at?: string;
  };

  return withDates.createdAt ?? withDates.created_at ?? withDates.sentAt ?? withDates.sent_at;
}

function SummaryCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  hint: string;
  icon: React.ElementType;
}) {
  return (
    <article className={styles.summaryCard}>
      <div className={styles.summaryIcon}>
        <Icon className="h-5 w-5" />
      </div>
      <span className={styles.summaryLabel}>{label}</span>
      <strong className={styles.summaryValue}>{value}</strong>
      <p className={styles.summaryHint}>{hint}</p>
    </article>
  );
}

function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
}: {
  icon?: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyIcon}>
        <Icon className="h-5 w-5" />
      </div>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  return (
    <span className={styles.statusChip} data-status={status.toLowerCase()}>
      {status}
    </span>
  );
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
      if (hasLoadedRef.current) setRefreshing(true);
      else setLoading(true);

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
        if (active) {
          setLoading(false);
          setRefreshing(false);
          hasLoadedRef.current = true;
        }
      }
    }

    void loadWorkspace();

    return () => {
      active = false;
    };
  }, [page, refreshKey]);

  useEffect(() => {
    let active = true;

    async function loadPreview() {
      if (selectedFormIds.length === 0) {
        setPreview(null);
        return;
      }

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

    return () => {
      active = false;
    };
  }, [selectedFormIds]);

  const parsedManualRecipients = useMemo(
    () => parseManualRecipients(manualRecipientsRaw),
    [manualRecipientsRaw],
  );

  const filteredForms = useMemo(() => {
    const query = formSearch.trim().toLowerCase();
    if (!query) return forms;

    return forms.filter((form) =>
      `${form.formTitle} ${form.isPublished ? 'published live' : 'draft'} ${form.uniqueRecipients} ${form.validRecipients}`
        .toLowerCase()
        .includes(query),
    );
  }, [formSearch, forms]);

  const selectedCurrentPageCount = forms.filter((form) => selectedFormIds.includes(form.formId)).length;
  const currentPageAllSelected = forms.length > 0 && forms.every((form) => selectedFormIds.includes(form.formId));
  const estimatedReach = (preview?.uniqueRecipients ?? 0) + parsedManualRecipients.length;

  function toggleForm(formId: string) {
    setSelectedFormIds((current) =>
      current.includes(formId) ? current.filter((item) => item !== formId) : [...current, formId],
    );
  }

  function toggleCurrentPage() {
    setSelectedFormIds((current) => {
      const next = new Set(current);

      if (currentPageAllSelected) {
        forms.forEach((form) => next.delete(form.formId));
      } else {
        forms.forEach((form) => next.add(form.formId));
      }

      return Array.from(next);
    });
  }

  function useTopAudiences() {
    const suggested = (summary?.topForms ?? []).slice(0, 3).map((item) => item.formId);
    if (suggested.length === 0) {
      toast.error('No top audience forms are available yet.');
      return;
    }

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
    try {
      await navigator.clipboard.writeText(htmlBody);
      toast.success('HTML body copied.');
    } catch {
      toast.error('Could not copy HTML body.');
    }
  }

  async function handleSendCampaign() {
    if (selectedFormIds.length === 0 && parsedManualRecipients.length === 0) {
      toast.error('Select at least one form or add manual recipients.');
      return;
    }

    if (!subject.trim()) {
      toast.error('Add a subject line before sending.');
      return;
    }

    if (!htmlBody.trim()) {
      toast.error('Add the HTML body for this campaign before sending.');
      return;
    }

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
    return (
      <div className={styles.loadingShell}>
        <div className={styles.loadingCard}>
          <div className={styles.loadingOrb} />
          <h1>Loading email marketing workspace</h1>
          <p>Preparing form audiences, compose tools, preview, and campaign history.</p>
        </div>
      </div>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <Link href="/dashboard" className={styles.backLink}>
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>

          <p className={styles.eyebrow}>
            <MailCheck className="h-4 w-4" />
            Email Marketing Studio
          </p>

          <h1>Build campaigns from your form audiences.</h1>

          <p>
            Pull email addresses from submitted forms, deduplicate the audience, add manual
            recipients, compose the message, preview it, and send through your existing backend.
          </p>

          <div className={styles.heroActions}>
            <Button type="button" onClick={useTopAudiences} icon={<Sparkles className="h-4 w-4" />}>
              Use top audiences
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => applyPreset('church-update')}
              icon={<LayoutTemplate className="h-4 w-4" />}
            >
              Load template
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={() => setRefreshKey((current) => current + 1)}
              disabled={refreshing}
              icon={<RefreshCw className={refreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />}
            >
              {refreshing ? 'Refreshing...' : 'Refresh data'}
            </Button>
          </div>
        </div>

        <div className={styles.summaryGrid}>
          <SummaryCard
            icon={Users}
            label="Reachable contacts"
            value={formatNumber(summary?.reachableRecipients ?? 0)}
            hint="Unique emails available across submitted form audiences."
          />

          <SummaryCard
            icon={FileText}
            label="Tracked forms"
            value={formatNumber(summary?.totalForms ?? 0)}
            hint={`${formatNumber(summary?.publishedForms ?? 0)} published forms ready for campaigns.`}
          />

          <SummaryCard
            icon={Send}
            label="Campaigns sent"
            value={formatNumber(Number(summary?.totalCampaigns ?? 0))}
            hint="Compose history remains visible for your admin team."
          />

          <SummaryCard
            icon={MousePointerClick}
            label="Current reach"
            value={formatNumber(estimatedReach)}
            hint="Selected form audience plus valid manual recipients."
          />
        </div>
      </section>

      <section className={styles.workspaceGrid}>
        <aside className={styles.audienceColumn}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelKicker}>Audience source</p>
                <h2>Choose recipient forms</h2>
                <p>Select forms whose submitted emails should receive this campaign.</p>
              </div>
              <span className={styles.panelMeta}>{formatNumber(formTotal)} forms</span>
            </div>

            <div className={styles.searchBox}>
              <Search className="h-4 w-4" />
              <input
                value={formSearch}
                onChange={(event) => setFormSearch(event.target.value)}
                placeholder="Search forms..."
              />
              {formSearch ? (
                <button type="button" onClick={() => setFormSearch('')} aria-label="Clear form search">
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            <div className={styles.audienceActions}>
              <Button type="button" variant="outline" onClick={toggleCurrentPage} disabled={forms.length === 0}>
                {currentPageAllSelected ? 'Unselect page' : 'Select page'}
              </Button>

              <Button type="button" variant="ghost" onClick={useTopAudiences} disabled={(summary?.topForms?.length ?? 0) === 0}>
                Top
              </Button>

              <Button type="button" variant="ghost" onClick={clearAudience} disabled={selectedFormIds.length === 0 && manualRecipientsRaw.length === 0}>
                Clear
              </Button>
            </div>

            <p className={styles.selectionHint}>
              {selectedFormIds.length} form{selectedFormIds.length === 1 ? '' : 's'} selected.
              {selectedCurrentPageCount > 0 ? ` ${selectedCurrentPageCount} selected on this page.` : ''}
            </p>

            <div className={styles.formList}>
              {filteredForms.map((form) => {
                const active = selectedFormIds.includes(form.formId);

                return (
                  <button
                    key={form.formId}
                    type="button"
                    className={styles.formCard}
                    data-active={active}
                    onClick={() => toggleForm(form.formId)}
                  >
                    <div className={styles.formCardHeader}>
                      <StatusChip status={form.isPublished ? 'live' : 'draft'} />
                      <strong>{formatNumber(form.uniqueRecipients)}</strong>
                    </div>

                    <div>
                      <h3 className={styles.formCardTitle}>{form.formTitle}</h3>
                      <p className={styles.formCardMeta}>
                        {formatNumber(form.totalSubmissions)} submissions · {formatNumber(form.validRecipients)} valid emails
                      </p>
                    </div>

                    <div className={styles.formCardFooter}>
                      <span>{form.lastSubmissionAt ? `Last response ${formatDate(form.lastSubmissionAt)}` : 'No responses yet'}</span>
                      <span>{active ? 'Selected' : 'Tap to add'}</span>
                    </div>
                  </button>
                );
              })}

              {filteredForms.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="No forms found"
                  description="Try another search term or refresh your email marketing workspace."
                />
              ) : null}
            </div>

            <div className={styles.pagination}>
              <Button type="button" variant="ghost" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>

              <span>Page {page} of {formTotalPages}</span>

              <Button type="button" variant="ghost" disabled={page >= formTotalPages} onClick={() => setPage((current) => Math.min(formTotalPages, current + 1))}>
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </section>
        </aside>

        <section className={styles.composePanel}>
          <div className={styles.composeHeader}>
            <div>
              <p className={styles.panelKicker}>Compose studio</p>
              <h2>Professional campaign composer</h2>
              <p>Write like Gmail: recipients, subject, templates, HTML body, text fallback, and preview.</p>
            </div>

            <div className={styles.composeHeaderActions}>
              <Button type="button" variant="outline" onClick={copyHtmlBody} icon={<Copy className="h-4 w-4" />}>
                Copy HTML
              </Button>

              <Button type="button" onClick={handleSendCampaign} loading={sending} icon={<Send className="h-4 w-4" />}>
                Send campaign
              </Button>
            </div>
          </div>

          {lastResult ? (
            <div className={styles.resultBanner}>
              <CheckCircle2 className="h-4 w-4" />
              <span>
                Last campaign delivered {formatNumber(lastResult.sent)} emails, skipped {formatNumber(lastResult.skipped)}, and failed {formatNumber(lastResult.failed)}.
              </span>
            </div>
          ) : null}

          <div className={styles.mailComposer}>
            <div className={styles.composerRow}>
              <span className={styles.composerLabel}>To</span>
              <div className={styles.recipientSummary}>
                {selectedFormIds.length > 0 ? (
                  <span>{selectedFormIds.length} selected form audience{selectedFormIds.length === 1 ? '' : 's'}</span>
                ) : null}

                {parsedManualRecipients.length > 0 ? (
                  <span>{parsedManualRecipients.length} manual recipient{parsedManualRecipients.length === 1 ? '' : 's'}</span>
                ) : null}

                {estimatedReach > 0 ? (
                  <strong>Estimated reach: {formatNumber(estimatedReach)}</strong>
                ) : (
                  <em>Select forms or add manual recipients.</em>
                )}
              </div>
            </div>

            <div className={styles.composerRow}>
              <label className={styles.composerLabel} htmlFor="campaign-subject">Subject</label>
              <input
                id="campaign-subject"
                className={styles.subjectInput}
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Add a clear subject line"
              />
            </div>

            <div className={styles.manualBlock}>
              <label className={styles.composerLabel} htmlFor="manual-recipients">Manual</label>
              <div className={styles.manualEditor}>
                <textarea
                  id="manual-recipients"
                  value={manualRecipientsRaw}
                  onChange={(event) => setManualRecipientsRaw(event.target.value)}
                  placeholder="person@example.com&#10;Jane Doe <jane@example.com>"
                />
                <p>One per line. Use either email only or <code>Name &lt;email&gt;</code>.</p>
              </div>
            </div>

            <div className={styles.templateBar}>
              <div className={styles.templateButtons}>
                {TEMPLATE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    data-active={selectedPresetId === preset.id}
                    onClick={() => applyPreset(preset.id)}
                    title={preset.description}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className={styles.modeToggle}>
                <button type="button" data-active={editorMode === 'html'} onClick={() => setEditorMode('html')}>
                  HTML
                </button>
                <button type="button" data-active={editorMode === 'text'} onClick={() => setEditorMode('text')}>
                  Text
                </button>
              </div>
            </div>

            <div className={styles.tokenRow}>
              {['{{ .FirstName }}', '{{ .Email }}', '{{ .UnsubscribeURL }}'].map((token) => (
                <button
                  key={token}
                  type="button"
                  className={styles.token}
                  onClick={() => {
                    if (editorMode === 'html') setHtmlBody((current) => `${current}\n${token}`);
                    else setTextBody((current) => `${current}\n${token}`);
                  }}
                >
                  {token}
                </button>
              ))}
            </div>

            {editorMode === 'html' ? (
              <textarea
                className={styles.codeEditor}
                value={htmlBody}
                onChange={(event) => setHtmlBody(event.target.value)}
                spellCheck={false}
              />
            ) : (
              <textarea
                className={styles.codeEditor}
                value={textBody}
                onChange={(event) => setTextBody(event.target.value)}
                spellCheck={false}
              />
            )}
          </div>

          <div className={styles.sendRow}>
            <p>
              Review your selected audience and rendered preview before sending. The backend will deduplicate overlapping recipients before delivery.
            </p>

            <Button type="button" onClick={handleSendCampaign} loading={sending} icon={<Send className="h-4 w-4" />}>
              Send campaign
            </Button>
          </div>
        </section>

        <aside className={styles.previewColumn}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelKicker}>Audience preview</p>
                <h2>Deduplicated recipients</h2>
                <p>Confirm delivery health before sending.</p>
              </div>
              {previewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            </div>

            <div className={styles.previewStats}>
              <article className={styles.previewStat}>
                <span>Unique</span>
                <strong>{formatNumber(preview?.uniqueRecipients ?? 0)}</strong>
              </article>
              <article className={styles.previewStat}>
                <span>Valid</span>
                <strong>{formatNumber(preview?.validRecipients ?? 0)}</strong>
              </article>
              <article className={styles.previewStat}>
                <span>Skipped</span>
                <strong>{formatNumber(preview?.skipped ?? 0)}</strong>
              </article>
            </div>

            {previewLoading ? (
              <div className={styles.loadingInline}>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Building audience preview...</span>
              </div>
            ) : preview ? (
              <div className={styles.recipientList}>
                {preview.recipients.map((recipient) => (
                  <article key={recipient.email} className={styles.recipientItem}>
                    <div className={styles.recipientMeta}>
                      <strong>{recipient.name || recipient.email}</strong>
                      {recipient.name ? <span>{recipient.email}</span> : null}
                    </div>

                    {recipient.sourceForms?.length ? (
                      <div className={styles.sourceChips}>
                        {recipient.sourceForms.slice(0, 3).map((source) => (
                          <span key={`${recipient.email}-${source.formId}`} className={styles.chip}>
                            {source.formTitle}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Users}
                title="No audience selected"
                description="Select one or more forms to preview the collated audience."
              />
            )}
          </section>

          <section className={styles.livePreview}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelKicker}>Live email</p>
                <h2>Rendered preview</h2>
                <p>Sample merge tags are replaced for preview only.</p>
              </div>
              <Eye className="h-4 w-4" />
            </div>

            <div className={styles.previewFrame}>
              <div className={styles.previewSubject}>
                <span>Subject</span>
                <strong>{subject || 'No subject'}</strong>
              </div>
              <div className={styles.previewCanvas} dangerouslySetInnerHTML={{ __html: renderPreviewHtml(htmlBody) }} />
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelKicker}>History</p>
                <h2>Recent campaigns</h2>
                <p>Latest delivery records from the compose backend.</p>
              </div>
              <Clock3 className="h-4 w-4" />
            </div>

            {history.length > 0 ? (
              <div className={styles.historyList}>
                {history.map((item) => (
                  <article key={item.id} className={styles.historyItem}>
                    <div>
                      <strong>{item.subject}</strong>
                      <p>
                        {formatNumber(item.targeted)} targeted · {formatNumber(item.sent)} sent · {formatNumber(item.failed)} failed
                      </p>
                      <span>{formatDateTime(getHistoryDate(item))}</span>
                    </div>
                    <StatusChip status={item.status} />
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Mail}
                title="No campaigns yet"
                description="Sent campaigns will appear here after delivery."
              />
            )}
          </section>
        </aside>
      </section>
    </main>
  );
}
