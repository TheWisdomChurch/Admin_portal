import { apiClient } from '../api';
import type { FormField, FormReportLinkPayload, FormSubmission } from '../types';
import { normalizeEmail, validateEmail } from '../utils';
import type { FieldInsight, FormAnalytics } from './formAnalytics';

export type FormSubmissionFilters = {
  query?: string;
  from?: string;
  to?: string;
};

export type FormCampaignRecipient = {
  submissionId: string;
  email: string;
  name: string;
  registrationCode?: string;
  submittedAt: string;
};

type SubmissionValues = FormSubmission['values'];
type SubmissionIdentitySource = Pick<FormSubmission, 'name' | 'email' | 'values'>;
export type ExportFormField = Pick<
  FormField,
  'key' | 'label' | 'order' | 'type' | 'required' | 'options' | 'validation'
>;

const APP_BASE_URL = (
  process.env.NEXT_PUBLIC_PUBLIC_URL ?? process.env.NEXT_PUBLIC_FRONTEND_URL ?? ''
).replace(/\/+$/, '');

function resolveAppUrl(path: string): string {
  const base =
    APP_BASE_URL ||
    (typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '');

  return base ? `${base}${path}` : path;
}

function sanitizeFilePart(value?: string): string {
  const normalized = (value || 'form-submissions')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');

  return normalized || 'form-submissions';
}

function buildFilename(prefix: string, fileLabel?: string): string {
  return `${prefix}-${sanitizeFilePart(fileLabel)}-${new Date().toISOString().slice(0, 10)}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
}

const MEDIA_URL_KEYS = [
  'url',
  'publicUrl',
  'public_url',
  'secure_url',
  'downloadUrl',
  'src',
];

/**
 * Public-form media fields are stored either as a hosted URL string (the
 * backend materialises data URLs to storage) or, for older/asset payloads, as
 * an object carrying a `url`/`publicUrl`. Resolve whichever to a usable link.
 */
export function resolveSubmissionMediaUrl(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:')) {
      return trimmed;
    }
    return null;
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    for (const key of MEDIA_URL_KEYS) {
      const candidate = record[key];
      if (
        typeof candidate === 'string' &&
        (/^https?:\/\//i.test(candidate) || candidate.startsWith('data:'))
      ) {
        return candidate.trim();
      }
    }
  }

  return null;
}

export function isLikelyImageUrl(url: string): boolean {
  if (url.startsWith('data:image/')) return true;
  return /\.(png|jpe?g|webp|gif|avif|bmp|svg)(\?|#|$)/i.test(url);
}

export type SubmissionMediaEntry = {
  key: string;
  label: string;
  url: string;
  isImage: boolean;
};

/** All uploaded-media answers on a submission, resolved to links. */
export function getSubmissionMediaEntries(
  submission: Pick<FormSubmission, 'values'>,
  fields?: ExportFormField[]
): SubmissionMediaEntry[] {
  const labelMap = buildFieldLabelMap(fields);
  const typeMap = new Map<string, string>();
  (fields || []).forEach((field) => {
    if (field.key) typeMap.set(field.key, String(field.type || ''));
  });

  const entries: SubmissionMediaEntry[] = [];
  Object.entries(submission.values || {}).forEach(([key, value]) => {
    if (key.startsWith('_')) return;
    const url = resolveSubmissionMediaUrl(value);
    if (!url) return;
    entries.push({
      key,
      label: resolveExportFieldLabel(key, labelMap),
      url,
      isImage: typeMap.get(key) === 'image' || isLikelyImageUrl(url),
    });
  });

  return entries;
}

export function submissionHasMedia(
  submission: Pick<FormSubmission, 'values'>
): boolean {
  return Object.entries(submission.values || {}).some(
    ([key, value]) =>
      !key.startsWith('_') && resolveSubmissionMediaUrl(value) !== null
  );
}

/** Fetch a (usually cross-origin, public) media URL and inline it as a data URL
 *  so it can be embedded into a generated PDF. Returns null on any failure. */
async function fetchAsDataUrl(url: string): Promise<string | null> {
  if (url.startsWith('data:')) return url;
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) return null;
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function dataUrlImageFormat(dataUrl: string): 'PNG' | 'JPEG' | null {
  const match = /^data:image\/([a-z0-9.+-]+)/i.exec(dataUrl);
  if (!match) return null;
  const kind = match[1].toLowerCase();
  if (kind === 'png') return 'PNG';
  if (kind === 'jpeg' || kind === 'jpg') return 'JPEG';
  // jsPDF addImage only reliably supports PNG/JPEG; other formats fall back to
  // the plain URL line already written above.
  return null;
}

export function serializeSubmissionValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((item) => serializeSubmissionValue(item))
      .filter(Boolean)
      .join('; ');
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '';
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.startsWith('data:') ? '[embedded file]' : trimmed;
  }
  if (value && typeof value === 'object') {
    const media = resolveSubmissionMediaUrl(value);
    if (media) return media.startsWith('data:') ? '[embedded file]' : media;
  }
  return '';
}

function escapeCsvCell(value: string): string {
  if (!/[",\n]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

function readSubmissionValue(values: SubmissionValues | undefined, key: string): string | undefined {
  if (!values) return undefined;
  const raw = values[key];
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  if (typeof raw === 'number') return String(raw);
  if (Array.isArray(raw) && raw.length > 0) return raw.join(', ');
  return undefined;
}

export function resolveFormSubmissionName(
  submission: SubmissionIdentitySource,
  fallback = 'Registrant'
): string {
  const direct = submission.name?.trim();
  if (direct) return direct;

  const values = submission.values as SubmissionValues | undefined;
  const fullName =
    readSubmissionValue(values, 'full_name') ||
    readSubmissionValue(values, 'fullName') ||
    readSubmissionValue(values, 'name');
  if (fullName) return fullName;

  const first = readSubmissionValue(values, 'first_name') || readSubmissionValue(values, 'firstName');
  const last = readSubmissionValue(values, 'last_name') || readSubmissionValue(values, 'lastName');
  const combined = [first, last].filter(Boolean).join(' ').trim();

  return combined || fallback;
}

export function resolveFormSubmissionEmail(submission: SubmissionIdentitySource): string {
  const direct = normalizeEmail(submission.email || '');
  if (direct) return direct;

  const values = submission.values as SubmissionValues | undefined;
  return normalizeEmail(
    readSubmissionValue(values, 'email') ||
      readSubmissionValue(values, 'email_address') ||
      readSubmissionValue(values, 'emailAddress') ||
      ''
  );
}

function deriveRecipientName(submission: FormSubmission): string {
  const resolvedName = resolveFormSubmissionName(submission, '');
  if (resolvedName) return resolvedName;

  const normalized = resolveFormSubmissionEmail(submission);
  if (!normalized) return 'Registrant';
  return normalized.split('@')[0] || 'Registrant';
}

function formatFieldLabel(key: string): string {
  const normalized = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return 'Field';

  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

export function buildFieldLabelMap(fields?: ExportFormField[]): Map<string, string> {
  const labelMap = new Map<string, string>();

  (fields || [])
    .slice()
    .sort((left, right) => (left.order || 0) - (right.order || 0))
    .forEach((field) => {
      const key = field.key?.trim();
      const label = field.label?.trim();
      if (!key || !label || labelMap.has(key)) return;
      labelMap.set(key, label);
    });

  return labelMap;
}

export function resolveExportFieldLabel(key: string, labelMap: Map<string, string>): string {
  return labelMap.get(key) || formatFieldLabel(key);
}

export function buildOrderedValueKeys(
  submissions: FormSubmission[],
  fields?: ExportFormField[]
): string[] {
  const orderedKeys: string[] = [];
  const seen = new Set<string>();

  (fields || [])
    .slice()
    .sort((left, right) => (left.order || 0) - (right.order || 0))
    .forEach((field) => {
      const key = field.key?.trim();
      if (!key || seen.has(key)) return;
      seen.add(key);
      orderedKeys.push(key);
    });

  submissions.forEach((submission) => {
    Object.keys(submission.values || {}).forEach((key) => {
      const normalizedKey = key.trim();
      if (!normalizedKey || seen.has(normalizedKey)) return;
      seen.add(normalizedKey);
      orderedKeys.push(normalizedKey);
    });
  });

  return orderedKeys;
}

function buildSubmissionResponseEntries(
  submission: FormSubmission,
  orderedValueKeys: string[]
): Array<[string, unknown]> {
  const values = submission.values || {};
  const seen = new Set<string>();
  const entries: Array<[string, unknown]> = [];

  orderedValueKeys.forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(values, key)) return;
    entries.push([key, values[key]]);
    seen.add(key);
  });

  Object.entries(values).forEach(([key, value]) => {
    const normalizedKey = key.trim();
    if (!normalizedKey || seen.has(normalizedKey)) return;
    entries.push([normalizedKey, value]);
  });

  return entries;
}

export function formatDateTime(value?: string): string {
  if (!value) return 'Not available';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function formatDateOnly(value?: string): string {
  if (!value) return 'Not set';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function sortFormSubmissionsByCreatedAt(submissions: FormSubmission[]): FormSubmission[] {
  return submissions.slice().sort((left, right) => {
    const leftTime = new Date(left.createdAt).getTime();
    const rightTime = new Date(right.createdAt).getTime();

    if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) return 0;
    if (Number.isNaN(leftTime)) return 1;
    if (Number.isNaN(rightTime)) return -1;
    return rightTime - leftTime;
  });
}

function buildFilterSummary(filters?: FormSubmissionFilters): string[] {
  const summary: string[] = [];

  if (filters?.query?.trim()) {
    summary.push(`Search: ${filters.query.trim()}`);
  }
  if (filters?.from?.trim()) {
    summary.push(`From: ${formatDateOnly(filters.from)}`);
  }
  if (filters?.to?.trim()) {
    summary.push(`To: ${formatDateOnly(filters.to)}`);
  }

  return summary;
}

export function buildFormSubmissionsReportPath(formId: string): string {
  return `/dashboard/reports/forms/${encodeURIComponent(formId)}`;
}

export function buildFormSubmissionsReportUrl(formId: string): string {
  return resolveAppUrl(buildFormSubmissionsReportPath(formId));
}

export async function getFormSubmissionsReportLink(formId: string): Promise<FormReportLinkPayload> {
  return apiClient.getAdminFormReportLink(formId);
}

export async function copyFormSubmissionsReportLink(formId: string): Promise<FormReportLinkPayload> {
  const link = await getFormSubmissionsReportLink(formId);
  await navigator.clipboard.writeText(link.reportUrl);
  return link;
}

export function filterFormSubmissions(
  submissions: FormSubmission[],
  filters?: FormSubmissionFilters
): FormSubmission[] {
  const term = filters?.query?.trim().toLowerCase() || '';
  const start = filters?.from ? new Date(filters.from) : null;
  const end = filters?.to ? new Date(filters.to) : null;

  if (start && Number.isNaN(start.getTime())) return sortFormSubmissionsByCreatedAt(submissions);
  if (end && Number.isNaN(end.getTime())) return sortFormSubmissionsByCreatedAt(submissions);

  return sortFormSubmissionsByCreatedAt(
    submissions.filter((submission) => {
      const haystack = [
        submission.name,
        submission.email,
        submission.contactNumber,
        submission.contactAddress,
        submission.registrationCode,
        ...Object.values(submission.values || {}).map((value) => serializeSubmissionValue(value)),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (term && !haystack.includes(term)) return false;

      if (start || end) {
        const created = new Date(submission.createdAt);
        if (Number.isNaN(created.getTime())) return false;
        if (start && created < start) return false;
        if (end) {
          const endOfDay = new Date(end);
          endOfDay.setHours(23, 59, 59, 999);
          if (created > endOfDay) return false;
        }
      }

      return true;
    })
  );
}

export async function exportFormSubmissionsPdf(
  submissions: FormSubmission[],
  fileLabel?: string,
  filters?: FormSubmissionFilters,
  fields?: ExportFormField[]
): Promise<void> {
  const orderedSubmissions = sortFormSubmissionsByCreatedAt(submissions);
  if (orderedSubmissions.length === 0) {
    throw new Error('No submissions to export');
  }

  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const orderedValueKeys = buildOrderedValueKeys(orderedSubmissions, fields);
  const fieldLabelMap = buildFieldLabelMap(fields);
  const fieldTypeMap = new Map<string, string>();
  (fields || []).forEach((field) => {
    if (field.key) fieldTypeMap.set(field.key, String(field.type || ''));
  });
  const margin = 44;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - margin * 2;
  const footerHeight = 28;
  let y = margin;

  const ensureSpace = (requiredHeight: number) => {
    if (y + requiredHeight <= pageHeight - margin - footerHeight) return;
    doc.addPage();
    y = margin;
  };

  const writeText = (
    text: string,
    options?: {
      fontSize?: number;
      fontStyle?: 'normal' | 'bold';
      color?: [number, number, number];
      indent?: number;
      gapAfter?: number;
    }
  ) => {
    const {
      fontSize = 11,
      fontStyle = 'normal',
      color = [31, 41, 55],
      indent = 0,
      gapAfter = 8,
    } = options || {};
    const lineHeight = fontSize * 1.35;
    const lines = doc.splitTextToSize(text, Math.max(64, maxWidth - indent));

    ensureSpace(lines.length * lineHeight + gapAfter);
    doc.setFont('helvetica', fontStyle);
    doc.setFontSize(fontSize);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(lines, margin + indent, y);
    y += lines.length * lineHeight + gapAfter;
  };

  const drawDivider = () => {
    ensureSpace(12);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(1);
    doc.line(margin, y, pageWidth - margin, y);
    y += 12;
  };

  writeText(fileLabel?.trim() || 'Form submissions report', {
    fontSize: 18,
    fontStyle: 'bold',
    color: [15, 23, 42],
    gapAfter: 6,
  });
  writeText(`Generated ${formatDateTime(new Date().toISOString())}`, {
    fontSize: 10,
    color: [100, 116, 139],
    gapAfter: 4,
  });
  writeText(`Total submissions: ${orderedSubmissions.length}`, {
    fontSize: 10,
    color: [71, 85, 105],
    gapAfter: 10,
  });

  const filterSummary = buildFilterSummary(filters);
  if (filterSummary.length > 0) {
    writeText(`Filters: ${filterSummary.join(' | ')}`, {
      fontSize: 10,
      color: [71, 85, 105],
      gapAfter: 12,
    });
  }

  const embedImage = async (url: string) => {
    const dataUrl = await fetchAsDataUrl(url);
    if (!dataUrl) return false;
    const format = dataUrlImageFormat(dataUrl);
    if (!format) return false;
    try {
      const props = doc.getImageProperties(dataUrl);
      const displayWidth = Math.min(140, maxWidth - 10);
      const displayHeight = (props.height / props.width) * displayWidth;
      ensureSpace(displayHeight + 10);
      doc.addImage(dataUrl, format, margin + 10, y, displayWidth, displayHeight);
      y += displayHeight + 10;
      return true;
    } catch {
      return false;
    }
  };

  drawDivider();

  for (const [index, submission] of orderedSubmissions.entries()) {
    const resolvedName = resolveFormSubmissionName(submission, '');
    const resolvedEmail = resolveFormSubmissionEmail(submission);
    const heading = resolvedName || resolvedEmail || `Submission ${index + 1}`;
    const details: Array<[string, string]> = [
      ['Submitted', formatDateTime(submission.createdAt)],
      ['Registration Code', submission.registrationCode || 'Not provided'],
      ['Email', resolvedEmail || 'Not provided'],
      ['Contact Number', submission.contactNumber || 'Not provided'],
      ['Contact Address', submission.contactAddress || 'Not provided'],
    ];
    const responseEntries = buildSubmissionResponseEntries(submission, orderedValueKeys);

    ensureSpace(80);
    writeText(heading, {
      fontSize: 13,
      fontStyle: 'bold',
      color: [15, 23, 42],
      gapAfter: 6,
    });

    details.forEach(([label, value]) => {
      writeText(`${label}: ${value}`, {
        fontSize: 10,
        color: [51, 65, 85],
        gapAfter: 4,
      });
    });

    if (responseEntries.length > 0) {
      writeText('Responses', {
        fontSize: 10,
        fontStyle: 'bold',
        color: [15, 23, 42],
        gapAfter: 4,
      });

      for (const [key, value] of responseEntries) {
        const label = resolveExportFieldLabel(key, fieldLabelMap);
        const mediaUrl = resolveSubmissionMediaUrl(value);
        const isImageField =
          mediaUrl != null &&
          (fieldTypeMap.get(key) === 'image' || isLikelyImageUrl(mediaUrl));

        writeText(`${label}: ${serializeSubmissionValue(value) || 'Not provided'}`, {
          fontSize: 10,
          color: [71, 85, 105],
          indent: 10,
          gapAfter: isImageField ? 2 : 4,
        });

        if (isImageField) {
          await embedImage(mediaUrl);
        }
      }
    } else {
      writeText('Responses: No custom fields submitted.', {
        fontSize: 10,
        color: [100, 116, 139],
        gapAfter: 4,
      });
    }

    if (index < orderedSubmissions.length - 1) {
      drawDivider();
    }
  }

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text(`Page ${page} of ${pages}`, pageWidth - margin, pageHeight - 12, { align: 'right' });
  }

  const filename = `${buildFilename('form-submissions', fileLabel)}.pdf`;
  const saveResult = (
    doc as unknown as {
      save: (name: string, options?: { returnPromise?: boolean }) => unknown;
    }
  ).save(filename, { returnPromise: true });

  if (saveResult && typeof (saveResult as PromiseLike<unknown>).then === 'function') {
    await saveResult;
  }
}

export async function fetchAllFormSubmissions(formId: string): Promise<FormSubmission[]> {
  const collected: FormSubmission[] = [];
  let page = 1;
  let totalPages = 1;
  const limit = 100;

  while (page <= totalPages) {
    const response = await apiClient.getFormSubmissions(formId, { page, limit });
    const pageItems = Array.isArray(response.data) ? response.data : [];

    collected.push(...pageItems);

    totalPages =
      typeof response.totalPages === 'number' && response.totalPages > 0
        ? response.totalPages
        : Math.max(1, Math.ceil((response.total || pageItems.length) / limit));

    if (pageItems.length === 0) break;
    page += 1;
  }

  return collected;
}

/* ============================================================================
   Excel workbook — Summary + Submissions + Field breakdown, all in one .xlsx.
============================================================================ */

function humanTrend(analytics: FormAnalytics): string {
  if (analytics.trend7 === null) return `${analytics.last7} in the last 7 days`;
  const arrow = analytics.trend7 > 0 ? '▲' : analytics.trend7 < 0 ? '▼' : '■';
  return `${analytics.last7} in the last 7 days (${arrow} ${Math.abs(analytics.trend7)}% vs previous 7)`;
}

function fieldBreakdownRows(field: FieldInsight): Array<[string, number, string]> {
  if (field.ageGroups) {
    return field.ageGroups.map((g) => [g.bucket, g.count, `${g.percent}%`]);
  }
  if (field.options) {
    return field.options.map((o) => [o.label, o.count, `${o.percent}%`]);
  }
  if (field.numeric) {
    return [
      ['Minimum', field.numeric.min, ''],
      ['Maximum', field.numeric.max, ''],
      ['Average', field.numeric.mean, ''],
      ['Median', field.numeric.median, ''],
    ];
  }
  return [];
}

export async function exportFormSubmissionsXlsx(
  submissions: FormSubmission[],
  form: { title?: string; fields?: ExportFormField[] } | undefined,
  analytics: FormAnalytics,
  fileLabel?: string
): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const fields = form?.fields;
  const ordered = sortFormSubmissionsByCreatedAt(submissions);
  const valueKeys = buildOrderedValueKeys(ordered, fields);
  const labelMap = buildFieldLabelMap(fields);
  const title = form?.title?.trim() || 'Form';

  const wb = new ExcelJS.Workbook();
  wb.creator = 'The Wisdom Church';
  wb.created = new Date();

  // ── Sheet 1: Summary ──────────────────────────────────────────────────
  const summary = wb.addWorksheet('Summary');
  summary.columns = [{ width: 34 }, { width: 60 }];
  const addRow = (k: string, v: string | number) => {
    const row = summary.addRow([k, v]);
    row.getCell(1).font = { bold: true };
  };
  summary.addRow([title]).getCell(1).font = { bold: true, size: 14 };
  summary.addRow([`Report generated ${formatDateTime(new Date().toISOString())}`]);
  summary.addRow([]);
  addRow('Total submissions', analytics.total);
  addRow('First submission', analytics.firstAt ? formatDateTime(analytics.firstAt) : '—');
  addRow('Latest submission', analytics.lastAt ? formatDateTime(analytics.lastAt) : '—');
  addRow('Recent activity', humanTrend(analytics));
  addRow('Last 30 days', `${analytics.last30} (was ${analytics.prev30} the prior 30)`);
  addRow('Busiest day', analytics.busiestDay ? `${analytics.busiestDay.date} (${analytics.busiestDay.count})` : '—');
  addRow('Most common weekday', analytics.busiestWeekday ?? '—');
  addRow('Avg. questions answered', `${analytics.avgFieldsCompleted} of ${(fields || []).filter((f) => !f.key.startsWith('_')).length}`);
  addRow('Completion rate (required)', `${Math.round(analytics.completionRate * 100)}%`);
  summary.addRow([]);
  summary.addRow(['Things to work on']).getCell(1).font = { bold: true, size: 12 };
  analytics.recommendations.forEach((rec) => {
    const row = summary.addRow([rec.severity.toUpperCase(), `${rec.title} — ${rec.detail}`]);
    row.getCell(1).font = { bold: true };
    row.getCell(2).alignment = { wrapText: true };
  });

  // ── Sheet 2: Submissions ──────────────────────────────────────────────
  const sheet = wb.addWorksheet('Submissions', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  const header = [
    'Name',
    'Email',
    'Phone',
    'Registration code',
    'Submitted',
    ...valueKeys.map((k) => resolveExportFieldLabel(k, labelMap)),
  ];
  sheet.addRow(header);
  sheet.getRow(1).font = { bold: true };
  ordered.forEach((s) => {
    sheet.addRow([
      resolveFormSubmissionName(s, ''),
      resolveFormSubmissionEmail(s),
      s.contactNumber || '',
      s.registrationCode || '',
      s.createdAt ? new Date(s.createdAt).toLocaleString() : '',
      ...valueKeys.map((k) => {
        const raw = s.values?.[k];
        return resolveSubmissionMediaUrl(raw) ?? serializeSubmissionValue(raw);
      }),
    ]);
  });
  sheet.columns.forEach((col) => {
    let max = 10;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      max = Math.min(60, Math.max(max, String(cell.value ?? '').length + 2));
    });
    col.width = max;
  });
  if (sheet.rowCount > 1) {
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: header.length } };
  }

  // ── Sheet 3: Field breakdown ──────────────────────────────────────────
  const breakdown = wb.addWorksheet('Field breakdown');
  breakdown.columns = [{ width: 40 }, { width: 12 }, { width: 12 }];
  analytics.fields
    .filter((f) => f.ageGroups || f.options || f.numeric)
    .forEach((f) => {
      breakdown.addRow([f.label]).getCell(1).font = { bold: true, size: 12 };
      breakdown.addRow(['Answered', f.responded, `${Math.round(f.responseRate * 100)}%`]);
      if (f.meanAgeYears !== undefined) {
        breakdown.addRow(['Average age', f.meanAgeYears, 'years']);
      }
      const head = breakdown.addRow(['Option', 'Count', 'Share']);
      head.font = { bold: true };
      fieldBreakdownRows(f).forEach((r) => breakdown.addRow(r));
      breakdown.addRow([]);
    });

  const buffer = await wb.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    `${buildFilename('form-report', fileLabel || title)}.xlsx`
  );
}

/* ============================================================================
   Report PDF — the analysis (KPIs, per-question breakdowns drawn as bars, and
   the recommendations), not a per-submission dump.
============================================================================ */

export async function exportFormReportPdf(
  analytics: FormAnalytics,
  form: { title?: string } | undefined,
  fileLabel?: string
): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const title = form?.title?.trim() || 'Form report';
  const margin = 44;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  const ensure = (h: number) => {
    if (y + h > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };
  const text = (
    value: string,
    opts?: { size?: number; style?: 'normal' | 'bold'; color?: [number, number, number]; gap?: number }
  ) => {
    const { size = 11, style = 'normal', color = [31, 41, 55], gap = 6 } = opts || {};
    const lines = doc.splitTextToSize(value, maxWidth);
    ensure(lines.length * size * 1.4 + gap);
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(lines, margin, y);
    y += lines.length * size * 1.4 + gap;
  };
  const bar = (label: string, count: number, percent: number, of: number) => {
    ensure(26);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(31, 41, 55);
    doc.text(doc.splitTextToSize(label, maxWidth - 90)[0], margin, y);
    const trackX = margin;
    const trackY = y + 4;
    const trackW = maxWidth;
    doc.setFillColor(226, 232, 240);
    doc.rect(trackX, trackY, trackW, 6, 'F');
    doc.setFillColor(245, 158, 11);
    doc.rect(trackX, trackY, Math.max(1, (trackW * Math.min(100, (count / (of || 1)) * 100)) / 100), 6, 'F');
    doc.setTextColor(100, 116, 139);
    doc.text(`${count}  ·  ${percent}%`, pageWidth - margin, y, { align: 'right' });
    y += 20;
  };

  text(title, { size: 18, style: 'bold', color: [15, 23, 42], gap: 4 });
  text(`Report generated ${formatDateTime(new Date().toISOString())}`, {
    size: 9.5,
    color: [100, 116, 139],
    gap: 14,
  });

  text('Overview', { size: 13, style: 'bold', color: [15, 23, 42] });
  const kpis: Array<[string, string]> = [
    ['Total submissions', String(analytics.total)],
    ['Last 7 days', analytics.trend7 === null ? String(analytics.last7) : `${analytics.last7}  (${analytics.trend7 > 0 ? '+' : ''}${analytics.trend7}% vs prev 7)`],
    ['Last 30 days', `${analytics.last30}  (was ${analytics.prev30})`],
    ['Latest submission', analytics.lastAt ? formatDateTime(analytics.lastAt) : '—'],
    ['Busiest weekday', analytics.busiestWeekday ?? '—'],
    ['Completion rate', `${Math.round(analytics.completionRate * 100)}%`],
    ['Avg. questions answered', String(analytics.avgFieldsCompleted)],
  ];
  kpis.forEach(([k, v]) => text(`${k}:  ${v}`, { size: 10, gap: 3 }));
  y += 10;

  const breakdowns = analytics.fields.filter((f) => f.ageGroups || f.options || f.numeric);
  if (breakdowns.length > 0) {
    text('Question breakdown', { size: 13, style: 'bold', color: [15, 23, 42] });
    breakdowns.forEach((f) => {
      text(`${f.label}   —   ${f.responded} answered (${Math.round(f.responseRate * 100)}%)${f.meanAgeYears !== undefined ? `,  avg age ${f.meanAgeYears}` : ''}`, {
        size: 10.5,
        style: 'bold',
        gap: 6,
      });
      if (f.ageGroups) {
        f.ageGroups.forEach((g) => bar(g.bucket, g.count, g.percent, f.responded));
      } else if (f.options) {
        f.options.forEach((o) => bar(o.label, o.count, o.percent, f.responded));
      } else if (f.numeric) {
        text(`min ${f.numeric.min}  ·  max ${f.numeric.max}  ·  avg ${f.numeric.mean}  ·  median ${f.numeric.median}`, { size: 10, gap: 4 });
      }
      y += 6;
    });
  }

  text('Data quality & recommendations', { size: 13, style: 'bold', color: [15, 23, 42] });
  analytics.recommendations.forEach((rec) => {
    const color: [number, number, number] =
      rec.severity === 'warn' ? [180, 83, 9] : rec.severity === 'critical' ? [185, 28, 28] : [55, 65, 81];
    text(`•  ${rec.title}`, { size: 10.5, style: 'bold', color, gap: 2 });
    text(rec.detail, { size: 9.5, color: [71, 85, 105], gap: 8 });
  });

  doc.save(`${buildFilename('form-report', fileLabel || title)}.pdf`);
}


export function exportFormSubmissionsCsv(
  submissions: FormSubmission[],
  fileLabel?: string,
  fields?: ExportFormField[]
): void {
  const orderedSubmissions = sortFormSubmissionsByCreatedAt(submissions);
  const valueKeys = buildOrderedValueKeys(orderedSubmissions, fields);
  const fieldLabelMap = buildFieldLabelMap(fields);

  const rows = [
    [
      'Name',
      'Email',
      'Contact Number',
      'Contact Address',
      'Registration Code',
      'Submitted At',
      ...valueKeys.map((key) => resolveExportFieldLabel(key, fieldLabelMap)),
    ],
    ...orderedSubmissions.map((submission) => [
      resolveFormSubmissionName(submission, ''),
      resolveFormSubmissionEmail(submission),
      submission.contactNumber || '',
      submission.contactAddress || '',
      submission.registrationCode || '',
      submission.createdAt ? new Date(submission.createdAt).toLocaleString() : '',
      ...valueKeys.map((key) => serializeSubmissionValue(submission.values?.[key])),
    ]),
  ];

  const csv = rows
    .map((row) => row.map((cell) => escapeCsvCell(String(cell ?? ''))).join(','))
    .join('\r\n');

  downloadBlob(
    new Blob([csv], { type: 'text/csv;charset=utf-8' }),
    `${buildFilename('form-submissions', fileLabel)}.csv`
  );
}

export function extractFormCampaignRecipients(
  submissions: FormSubmission[]
): FormCampaignRecipient[] {
  const deduped = new Map<string, FormCampaignRecipient>();

  sortFormSubmissionsByCreatedAt(submissions).forEach((submission) => {
    const normalizedEmail = resolveFormSubmissionEmail(submission);
    if (!normalizedEmail || !validateEmail(normalizedEmail)) return;
    if (deduped.has(normalizedEmail)) return;

    deduped.set(normalizedEmail, {
      submissionId: submission.id,
      email: normalizedEmail,
      name: deriveRecipientName(submission),
      registrationCode: submission.registrationCode || undefined,
      submittedAt: submission.createdAt,
    });
  });

  return Array.from(deduped.values());
}

export function exportFormCampaignRecipientsCsv(
  recipients: FormCampaignRecipient[],
  fileLabel?: string
): void {
  const rows = [
    ['Name', 'Email', 'Registration Code', 'Submitted At'],
    ...recipients.map((recipient) => [
      recipient.name,
      recipient.email,
      recipient.registrationCode || '',
      recipient.submittedAt ? new Date(recipient.submittedAt).toLocaleString() : '',
    ]),
  ];

  const csv = rows
    .map((row) => row.map((cell) => escapeCsvCell(String(cell ?? ''))).join(','))
    .join('\r\n');

  downloadBlob(
    new Blob([csv], { type: 'text/csv;charset=utf-8' }),
    `${buildFilename('form-campaign-audience', fileLabel)}.csv`
  );
}
