import { apiClient } from './api';
import type { FormSubmission } from './types';

export type FormSubmissionFilters = {
  query?: string;
  from?: string;
  to?: string;
};

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

function buildFilterQuery(filters?: FormSubmissionFilters): string {
  if (!filters) return '';

  const params = new URLSearchParams();
  if (filters.query?.trim()) params.set('q', filters.query.trim());
  if (filters.from?.trim()) params.set('from', filters.from.trim());
  if (filters.to?.trim()) params.set('to', filters.to.trim());

  const query = params.toString();
  return query ? `?${query}` : '';
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

export function buildFormSubmissionsReportPath(formId: string): string {
  return `/dashboard/forms/${encodeURIComponent(formId)}/submissions`;
}

export function buildFormSubmissionsReportUrl(formId: string): string {
  return resolveAppUrl(buildFormSubmissionsReportPath(formId));
}

export function filterFormSubmissions(
  submissions: FormSubmission[],
  filters?: FormSubmissionFilters
): FormSubmission[] {
  const term = filters?.query?.trim().toLowerCase() || '';
  const start = filters?.from ? new Date(filters.from) : null;
  const end = filters?.to ? new Date(filters.to) : null;

  if (start && Number.isNaN(start.getTime())) return submissions;
  if (end && Number.isNaN(end.getTime())) return submissions;

  return submissions
    .filter((submission) => {
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
    .sort((left, right) => {
      const leftTime = new Date(left.createdAt).getTime();
      const rightTime = new Date(right.createdAt).getTime();

      if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) return 0;
      if (Number.isNaN(leftTime)) return 1;
      if (Number.isNaN(rightTime)) return -1;
      return rightTime - leftTime;
    });
}

export async function exportFormSubmissionsPdf(
  formId: string,
  fileLabel?: string,
  filters?: FormSubmissionFilters
): Promise<void> {
  const endpoint = `/api/v1/admin/forms/${encodeURIComponent(formId)}/submissions/export.pdf${buildFilterQuery(filters)}`;

  const response = await fetch(endpoint, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/pdf' },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `Export failed (${response.status})`);
  }

  const blob = await response.blob();
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
  const valueKeys: string[] = [];
  const seen = new Set<string>();

  submissions.forEach((submission) => {
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
    ...submissions.map((submission) => [
      submission.name || '',
      submission.email || '',
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
