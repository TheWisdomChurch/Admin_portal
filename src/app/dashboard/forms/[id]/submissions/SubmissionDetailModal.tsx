'use client';

import { useMemo } from 'react';
import { Download, ExternalLink, X } from 'lucide-react';

import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Modal } from '@/ui/Modal';
import {
  isLikelyImageUrl,
  resolveFormSubmissionEmail,
  resolveFormSubmissionName,
  resolveSubmissionMediaUrl,
} from '@/lib/forms/formSubmissions';
import { formatStoredFormDate, isStoredFormDate } from '@/lib/forms/formatFieldDate';
import type { AdminForm, FormField, FormSubmission } from '@/lib/types';

interface SubmissionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  submission: FormSubmission | null;
  form: AdminForm | null;
}

const MEDIA_TYPES = new Set(['image', 'file', 'upload', 'video', 'audio', 'document']);

function formatScalar(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (isStoredFormDate(value)) return formatStoredFormDate(value);
  return String(value);
}

function optionLabel(field: FormField | undefined, raw: string): string {
  const match = field?.options?.find((option) => option.value === raw);
  return match?.label || raw;
}

function AnswerValue({
  field,
  value,
}: {
  field: FormField | undefined;
  value: unknown;
}) {
  const mediaUrl = resolveSubmissionMediaUrl(value);
  const isMediaField = field ? MEDIA_TYPES.has(field.type) : false;

  if (mediaUrl && (isMediaField || isLikelyImageUrl(mediaUrl))) {
    const showImage = field?.type === 'image' || isLikelyImageUrl(mediaUrl);
    return (
      <div className="flex items-start gap-3">
        {showImage ? (
          <a href={mediaUrl} target="_blank" rel="noreferrer" className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- external, one-off submission thumbnail */}
            <img
              src={mediaUrl}
              alt={field?.label || 'Uploaded file'}
              className="h-24 w-24 rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] object-cover"
            />
          </a>
        ) : null}
        <div className="flex flex-col gap-1.5">
          <a
            href={mediaUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-accent-primary)] hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Open
          </a>
          <a
            href={mediaUrl}
            download
            className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            <Download className="h-3.5 w-3.5" /> Download
          </a>
        </div>
      </div>
    );
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-[var(--color-text-tertiary)]">—</span>;
    return (
      <div className="flex flex-wrap gap-1.5">
        {value.map((item, index) => (
          <Badge key={`${String(item)}-${index}`} variant="secondary">
            {optionLabel(field, String(item))}
          </Badge>
        ))}
      </div>
    );
  }

  if (typeof value === 'boolean') {
    return <Badge variant={value ? 'success' : 'default'}>{value ? 'Yes' : 'No'}</Badge>;
  }

  if ((field?.type === 'select' || field?.type === 'radio') && typeof value === 'string') {
    return <span className="text-[var(--color-text-primary)]">{optionLabel(field, value)}</span>;
  }

  const text = formatScalar(value);
  return (
    <span className="whitespace-pre-wrap break-words text-[var(--color-text-primary)]">
      {text}
    </span>
  );
}

export function SubmissionDetailModal({
  isOpen,
  onClose,
  submission,
  form,
}: SubmissionDetailModalProps) {
  const rows = useMemo(() => {
    if (!submission) return [];

    const values = submission.values || {};
    const orderedFields = (form?.fields || [])
      .slice()
      .sort((left, right) => (left.order || 0) - (right.order || 0));

    const seen = new Set<string>();
    const result: Array<{ key: string; label: string; field?: FormField; value: unknown }> = [];

    orderedFields.forEach((field) => {
      if (!field.key || seen.has(field.key)) return;
      seen.add(field.key);
      if (!(field.key in values)) return;
      result.push({ key: field.key, label: field.label || field.key, field, value: values[field.key] });
    });

    Object.entries(values).forEach(([key, value]) => {
      if (seen.has(key) || key.startsWith('_')) return;
      seen.add(key);
      result.push({ key, label: key, value });
    });

    return result;
  }, [submission, form]);

  if (!submission) return null;

  const name = resolveFormSubmissionName(submission, 'Anonymous');
  const email = resolveFormSubmissionEmail(submission);
  const consentVersion = (submission.values?._consentVersion as string) || '';
  const consentRecordedAt = (submission.values?._consentRecordedAt as string) || '';

  const meta: Array<[string, string]> = [
    ['Email', email || '—'],
    ['Phone', submission.contactNumber || '—'],
    ['Address', submission.contactAddress || '—'],
    ['Registration code', submission.registrationCode || '—'],
    ['Submitted', submission.createdAt ? new Date(submission.createdAt).toLocaleString() : '—'],
  ];

  return (
    <Modal open={isOpen} onClose={onClose} size="xl" labelledBy="submission-detail-title">
      <div className="flex max-h-[92dvh] flex-col">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border-secondary)] p-5 sm:p-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
              {form?.title || 'Form submission'}
            </p>
            <h2
              id="submission-detail-title"
              className="mt-1 truncate text-lg font-bold text-[var(--color-text-primary)]"
            >
              {name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-1 text-[var(--color-text-tertiary)] transition hover:bg-[var(--color-background-secondary)] hover:text-[var(--color-text-primary)]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-3 border-b border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-5 sm:grid-cols-2 sm:p-6">
          {meta.map(([label, value]) => (
            <div key={label}>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
                {label}
              </p>
              <p className="mt-0.5 break-words text-sm text-[var(--color-text-primary)]">{value}</p>
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {rows.length === 0 ? (
            <p className="text-sm text-[var(--color-text-tertiary)]">
              This submission has no field responses.
            </p>
          ) : (
            <dl className="space-y-4">
              {rows.map((row) => (
                <div
                  key={row.key}
                  className="grid gap-1 border-b border-[var(--color-border-secondary)] pb-4 last:border-0 last:pb-0 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)] sm:gap-4"
                >
                  <dt className="text-sm font-semibold text-[var(--color-text-secondary)]">
                    {row.label}
                  </dt>
                  <dd className="text-sm">
                    <AnswerValue field={row.field} value={row.value} />
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border-secondary)] p-4 sm:px-6">
          <p className="text-xs text-[var(--color-text-tertiary)]">
            {consentVersion ? `Consent v${consentVersion}` : 'Consent not recorded'}
            {consentRecordedAt
              ? ` · accepted ${new Date(consentRecordedAt).toLocaleString()}`
              : ''}
          </p>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
