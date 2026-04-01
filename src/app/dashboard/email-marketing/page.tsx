'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  Loader2,
  Mail,
  RefreshCw,
  Send,
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

const DEFAULT_HTML_TEMPLATE = `<section style="font-family: Georgia, 'Times New Roman', serif; color: #1f2937; line-height: 1.7;">
  <p>Hello {{ .FirstName }},</p>
  <h1 style="font-size: 30px; margin: 0 0 14px; color: #111827;">A fresh word from Wisdom Church</h1>
  <p>We are reaching out with a new update for everyone who recently connected with us through a Wisdom Church form.</p>
  <p>Stay close to the house, watch out for the next announcement, and keep building with us.</p>
  <p style="margin-top: 24px;">Grace and peace,<br />Wisdom Church</p>
  <p style="margin-top: 24px; font-size: 12px; color: #6b7280;">
    Prefer not to receive these emails? <a href="{{ .UnsubscribeURL }}">Unsubscribe here</a>.
  </p>
</section>`;

const DEFAULT_TEXT_TEMPLATE = `Hello {{ .FirstName }},

We are reaching out with a new update for everyone who recently connected with Wisdom Church.
Stay close to the house, watch out for the next announcement, and keep building with us.

Grace and peace,
Wisdom Church

Unsubscribe: {{ .UnsubscribeURL }}`;

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
    const name = angled ? angled[1].trim() : '';

    if (!email.includes('@') || seen.has(email)) {
      return;
    }

    seen.add(email);
    if (name) {
      recipients.push({ name, email });
      return;
    }
    recipients.push({ email });
  });

  return recipients;
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
  const [subject, setSubject] = useState('Wisdom Church Update');
  const [htmlBody, setHtmlBody] = useState(DEFAULT_HTML_TEMPLATE);
  const [textBody, setTextBody] = useState(DEFAULT_TEXT_TEMPLATE);
  const [manualRecipientsRaw, setManualRecipientsRaw] = useState('');
  const [lastResult, setLastResult] = useState<SendAdminComposeEmailResponse | null>(null);

  useEffect(() => {
    let active = true;

    async function loadWorkspace() {
      if (summary) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const [summaryData, formData, historyData] = await Promise.all([
          apiClient.getEmailMarketingSummary(),
          apiClient.listEmailMarketingForms({ page, limit: 8 }),
          apiClient.listAdminComposeHistory({ page: 1, limit: 6 }),
        ]);

        if (!active) return;

        setSummary(summaryData);
        setForms(formData.data);
        setFormTotal(formData.total);
        setFormTotalPages(formData.totalPages);
        setHistory(historyData.data);
      } catch (error) {
        if (active) {
          toast.error(getServerErrorMessage(error, 'Failed to load email marketing workspace.'));
        }
      } finally {
        if (active) {
          setLoading(false);
          setRefreshing(false);
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
        if (active) {
          setPreview(data);
        }
      } catch (error) {
        if (active) {
          toast.error(getServerErrorMessage(error, 'Failed to load audience preview.'));
        }
      } finally {
        if (active) {
          setPreviewLoading(false);
        }
      }
    }

    void loadPreview();

    return () => {
      active = false;
    };
  }, [selectedFormIds]);

  const parsedManualRecipients = parseManualRecipients(manualRecipientsRaw);

  function toggleForm(formId: string) {
    setSelectedFormIds((current) =>
      current.includes(formId) ? current.filter((item) => item !== formId) : [...current, formId]
    );
  }

  function useTopAudiences() {
    const suggested = (summary?.topForms ?? []).slice(0, 3).map((item) => item.formId);
    setSelectedFormIds(suggested);
  }

  async function handleSendCampaign() {
    if (selectedFormIds.length === 0 && parsedManualRecipients.length === 0) {
      toast.error('Select at least one form or add manual recipients.');
      return;
    }

    if (!htmlBody.trim()) {
      toast.error('Add the HTML body for this campaign before sending.');
      return;
    }

    setSending(true);
    try {
      const payload: SendAdminComposeEmailRequest = {
        subject: subject.trim() || undefined,
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
        <div className={styles.loadingOrb} />
        <p>Loading email marketing workspace...</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Email Marketing</p>
          <h1>Build campaigns from the emails your forms are already collecting.</h1>
          <p>
            Select recent forms, preview the deduplicated audience, write the message once, and send it
            directly from the admin.
          </p>

          <div className={styles.heroActions}>
            <Link href="/dashboard" className={styles.heroLink}>
              Back to dashboard
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/dashboard/forms" className={styles.heroLinkSecondary}>
              Review forms
            </Link>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRefreshKey((current) => current + 1)}
              disabled={refreshing}
              icon={<RefreshCw className="h-4 w-4" />}
            >
              {refreshing ? 'Refreshing...' : 'Refresh data'}
            </Button>
          </div>
        </div>

        <div className={styles.summaryGrid}>
          <article className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Reachable contacts</span>
            <strong className={styles.summaryValue}>{formatNumber(summary?.reachableRecipients ?? 0)}</strong>
            <p className={styles.summaryHint}>Unique emails available across your form audiences.</p>
          </article>
          <article className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Tracked forms</span>
            <strong className={styles.summaryValue}>{formatNumber(summary?.totalForms ?? 0)}</strong>
            <p className={styles.summaryHint}>{formatNumber(summary?.publishedForms ?? 0)} published and ready.</p>
          </article>
          <article className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Campaigns sent</span>
            <strong className={styles.summaryValue}>{formatNumber(Number(summary?.totalCampaigns ?? 0))}</strong>
            <p className={styles.summaryHint}>Compose history stays visible for the team.</p>
          </article>
          <article className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Selected audience</span>
            <strong className={styles.summaryValue}>{formatNumber(preview?.uniqueRecipients ?? 0)}</strong>
            <p className={styles.summaryHint}>Live deduplicated recipients from the current form selection.</p>
          </article>
        </div>
      </section>

      <div className={styles.workspaceGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelKicker}>Audience source</p>
              <h2>Choose the forms to collate</h2>
            </div>
            <span className={styles.panelMeta}>{formatNumber(formTotal)} forms</span>
          </div>

          <div className={styles.inlineActions}>
            <Button type="button" variant="ghost" onClick={useTopAudiences} disabled={(summary?.topForms?.length ?? 0) === 0}>
              Use top audiences
            </Button>
            <p className={styles.helper}>The list is sorted by the most recently updated forms.</p>
          </div>

          <div className={styles.formGrid}>
            {forms.map((form) => {
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
                    <span className={styles.statusChip} data-status={form.isPublished ? 'live' : 'draft'}>
                      {form.isPublished ? 'live' : 'draft'}
                    </span>
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
          </div>

          <div className={styles.pagination}>
            <Button type="button" variant="ghost" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
              Previous
            </Button>
            <span>Page {page} of {formTotalPages}</span>
            <Button type="button" variant="ghost" disabled={page >= formTotalPages} onClick={() => setPage((current) => current + 1)}>
              Next
            </Button>
          </div>
        </section>

        <div className={styles.sideStack}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelKicker}>Audience preview</p>
                <h2>Deduplicated recipients</h2>
              </div>
              <span className={styles.panelMeta}>{selectedFormIds.length} forms selected</span>
            </div>

            {previewLoading ? (
              <div className={styles.loadingInline}>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Building audience preview...</span>
              </div>
            ) : preview ? (
              <>
                <div className={styles.previewStats}>
                  <article className={styles.previewStat}>
                    <span>Unique recipients</span>
                    <strong>{formatNumber(preview.uniqueRecipients)}</strong>
                  </article>
                  <article className={styles.previewStat}>
                    <span>Valid emails</span>
                    <strong>{formatNumber(preview.validRecipients)}</strong>
                  </article>
                  <article className={styles.previewStat}>
                    <span>Skipped duplicates</span>
                    <strong>{formatNumber(preview.skipped)}</strong>
                  </article>
                </div>

                <div className={styles.recipientList}>
                  {preview.recipients.map((recipient) => (
                    <article key={recipient.email} className={styles.recipientItem}>
                      <div className={styles.recipientMeta}>
                        <strong>{recipient.name || recipient.email}</strong>
                        {recipient.name && <span>{recipient.email}</span>}
                      </div>
                      <div className={styles.sourceChips}>
                        {recipient.sourceForms?.map((source) => (
                          <span key={`${recipient.email}-${source.formId}`} className={styles.chip}>
                            {source.formTitle}
                          </span>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <p className={styles.placeholder}>
                Select one or more forms to preview the collated audience before you send.
              </p>
            )}
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelKicker}>History</p>
                <h2>Recent campaigns</h2>
              </div>
              <Mail className="h-4 w-4" />
            </div>

            {history.length > 0 ? (
              <div className={styles.historyList}>
                {history.map((item) => (
                  <article key={item.id} className={styles.historyItem}>
                    <div>
                      <strong>{item.subject}</strong>
                      <p>{item.targeted} targeted · {item.sent} sent · {item.failed} failed</p>
                    </div>
                    <span className={styles.statusChip} data-status={item.status}>{item.status}</span>
                  </article>
                ))}
              </div>
            ) : (
              <p className={styles.placeholder}>
                Sent campaigns will appear here.
              </p>
            )}
          </section>
        </div>
      </div>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.panelKicker}>Compose studio</p>
            <h2>Write once, send to the selected audience</h2>
          </div>
          <span className={styles.panelMeta}>
            {formatNumber(parsedManualRecipients.length)} manual recipients added
          </span>
        </div>

        {lastResult && (
          <div className={styles.resultBanner}>
            <CheckCircle2 className="h-4 w-4" />
            <span>
              Last campaign delivered {lastResult.sent} emails, skipped {lastResult.skipped}, and failed {lastResult.failed}.
            </span>
          </div>
        )}

        <div className={styles.composeGrid}>
          <div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="marketing-subject">Subject</label>
              <input
                id="marketing-subject"
                className={styles.input}
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Wisdom Church Update"
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="manual-recipients">Manual recipients</label>
              <textarea
                id="manual-recipients"
                className={styles.textarea}
                value={manualRecipientsRaw}
                onChange={(event) => setManualRecipientsRaw(event.target.value)}
                placeholder="person@example.com\nJane Doe <jane@example.com>"
              />
              <p className={styles.helper}>One per line. Use either an email alone or <code>Name &lt;email&gt;</code>.</p>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="html-body">HTML body</label>
              <textarea
                id="html-body"
                className={styles.largeTextarea}
                value={htmlBody}
                onChange={(event) => setHtmlBody(event.target.value)}
              />
              <div className={styles.tokenRow}>
                <span className={styles.token}>{'{{ .FirstName }}'}</span>
                <span className={styles.token}>{'{{ .Email }}'}</span>
                <span className={styles.token}>{'{{ .UnsubscribeURL }}'}</span>
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="text-body">Text fallback</label>
              <textarea
                id="text-body"
                className={styles.textarea}
                value={textBody}
                onChange={(event) => setTextBody(event.target.value)}
              />
            </div>
          </div>

          <div className={styles.previewStack}>
            <div className={styles.targetCard}>
              <p className={styles.panelKicker}>Campaign reach</p>
              <div className={styles.targetMetrics}>
                <article className={styles.targetMetric}>
                  <span>Selected forms</span>
                  <strong>{formatNumber(selectedFormIds.length)}</strong>
                </article>
                <article className={styles.targetMetric}>
                  <span>Preview audience</span>
                  <strong>{formatNumber(preview?.uniqueRecipients ?? 0)}</strong>
                </article>
                <article className={styles.targetMetric}>
                  <span>Manual recipients</span>
                  <strong>{formatNumber(parsedManualRecipients.length)}</strong>
                </article>
              </div>
              <p className={styles.helper}>The backend deduplicates overlapping emails across selected forms and manual entries before delivery.</p>
            </div>

            <div className={styles.livePreview}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.panelKicker}>Live preview</p>
                  <h2>How the message will look</h2>
                </div>
                <Eye className="h-4 w-4" />
              </div>
              <div className={styles.previewCanvas} dangerouslySetInnerHTML={{ __html: htmlBody }} />
            </div>
          </div>
        </div>

        <div className={styles.sendRow}>
          <div>
            <p className={styles.helper}>Use the preview to confirm your selection before sending the live campaign.</p>
          </div>
          <Button type="button" onClick={handleSendCampaign} loading={sending} icon={<Send className="h-4 w-4" />}>
            Send campaign
          </Button>
        </div>
      </section>
    </div>
  );
}
