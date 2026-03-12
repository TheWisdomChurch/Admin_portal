import { apiClient } from './api';
import type { FormReportLinkPayload, FormSubmission } from './types';
import { normalizeEmail, validateEmail } from './utils';

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

function serializeSubmissionValue(value: unknown): string {
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
    return value.trim();
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

function formatDateTime(value?: string): string {
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

function sortFormSubmissionsByCreatedAt(submissions: FormSubmission[]): FormSubmission[] {
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
  filters?: FormSubmissionFilters
): Promise<void> {
  const orderedSubmissions = sortFormSubmissionsByCreatedAt(submissions);
  if (orderedSubmissions.length === 0) {
    throw new Error('No submissions to export');
  }

  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
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

  drawDivider();

  orderedSubmissions.forEach((submission, index) => {
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
    const responseEntries = Object.entries(submission.values || {});

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

      responseEntries.forEach(([key, value]) => {
        writeText(`${formatFieldLabel(key)}: ${serializeSubmissionValue(value) || 'Not provided'}`, {
          fontSize: 10,
          color: [71, 85, 105],
          indent: 10,
          gapAfter: 4,
        });
      });
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
  });

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text(`Page ${page} of ${pages}`, pageWidth - margin, pageHeight - 12, { align: 'right' });
  }

  const blob = doc.output('blob');
  downloadBlob(blob, `${buildFilename('form-submissions', fileLabel)}.pdf`);
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

export function exportFormSubmissionsCsv(
  submissions: FormSubmission[],
  fileLabel?: string
): void {
  const orderedSubmissions = sortFormSubmissionsByCreatedAt(submissions);
  const valueKeys: string[] = [];
  const seen = new Set<string>();

  orderedSubmissions.forEach((submission) => {
    Object.keys(submission.values || {}).forEach((key) => {
      if (seen.has(key)) return;
      seen.add(key);
      valueKeys.push(key);
    });
  });

  const rows = [
    [
      'Name',
      'Email',
      'Contact Number',
      'Contact Address',
      'Registration Code',
      'Submitted At',
      ...valueKeys,
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
