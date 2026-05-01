'use client';

import React, { useState } from 'react';
import {
  inferUploadKindFromFile,
  inferUploadKindFromField,
  type UploadFieldDescriptor,
} from '@/lib/prepareUploadPayload';
import type { UploadKind } from '@/lib/uploads';

type MediaUploadFieldProps = {
  field: UploadFieldDescriptor;
  value?: File | null;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  className?: string;
  onChange: (file: File | null) => void;
};

const MB = 1024 * 1024;

const DEFAULT_UPLOAD_LIMIT_MB: Record<UploadKind, number> = {
  image: 5,
  video: 100,
  audio: 50,
  document: 20,
  file: 25,
};

const ACCEPTED_UPLOAD_TYPES: Record<UploadKind, string[]> = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  video: ['video/mp4', 'video/quicktime', 'video/webm'],
  audio: ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/ogg'],
  document: [
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  file: [],
};

const ACCEPTED_UPLOAD_EXTENSIONS: Record<UploadKind, string[]> = {
  image: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
  video: ['.mp4', '.mov', '.webm'],
  audio: ['.mp3', '.m4a', '.wav', '.webm', '.ogg'],
  document: ['.pdf', '.txt', '.csv', '.doc', '.docx', '.xls', '.xlsx'],
  file: [],
};

function getUploadAccept(kind: UploadKind): string | undefined {
  const values = [
    ...ACCEPTED_UPLOAD_TYPES[kind],
    ...ACCEPTED_UPLOAD_EXTENSIONS[kind],
  ];

  return values.length > 0 ? values.join(',') : undefined;
}

function getUploadFormatLabel(kind: UploadKind): string {
  const extensions = ACCEPTED_UPLOAD_EXTENSIONS[kind];
  return extensions.length > 0 ? extensions.join(', ') : 'common file types';
}

function getUploadLimitMb(field: UploadFieldDescriptor, kind: UploadKind): number {
  const configuredMax = field.validation?.max;

  if (typeof configuredMax === 'number' && configuredMax > 0) {
    return configuredMax > 512 ? Math.ceil(configuredMax / MB) : configuredMax;
  }

  return DEFAULT_UPLOAD_LIMIT_MB[kind];
}

export function validateMediaFile(
  field: UploadFieldDescriptor,
  file: File
): string | null {
  const kind = inferUploadKindFromFile(file, field);
  const acceptedTypes = ACCEPTED_UPLOAD_TYPES[kind];
  const acceptedExts = ACCEPTED_UPLOAD_EXTENSIONS[kind];
  const maxMb = getUploadLimitMb(field, kind);

  if (acceptedTypes.length > 0 && !acceptedTypes.includes(file.type)) {
    const lowerName = file.name.toLowerCase();
    const extOk = acceptedExts.some((ext) => lowerName.endsWith(ext));

    if (!extOk) {
      return `Unsupported file type. Accepted formats: ${getUploadFormatLabel(kind)}.`;
    }
  }

  if (file.size > maxMb * MB) {
    return `File must be ${maxMb}MB or smaller.`;
  }

  return null;
}

export default function MediaUploadField({
  field,
  value,
  required,
  disabled,
  error,
  className,
  onChange,
}: MediaUploadFieldProps) {
  const [localError, setLocalError] = useState('');
  const selected = value instanceof File ? value : null;
  const kind = selected
    ? inferUploadKindFromFile(selected, field)
    : inferUploadKindFromField(field);

  const maxMb = getUploadLimitMb(field, kind);
  const visibleError = error || localError;

  return (
    <div className="space-y-2">
      {field.label ? (
        <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
          {field.label}
        </label>
      ) : null}
      <input
        type="file"
        accept={getUploadAccept(kind)}
        disabled={disabled}
        required={required}
        className={
          className ||
          'w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)]'
        }
        onChange={(event) => {
          const file = event.target.files?.[0] || null;

          if (!file) {
            setLocalError('');
            onChange(null);
            return;
          }

          const validationError = validateMediaFile(field, file);
          if (validationError) {
            event.currentTarget.value = '';
            setLocalError(validationError);
            onChange(null);
            return;
          }

          setLocalError('');
          onChange(file);
        }}
      />

      <div className="text-xs text-[var(--color-text-tertiary)]">
        Accepted formats: {getUploadFormatLabel(kind)}. Max {maxMb}MB.
      </div>

      {selected ? (
        <div className="text-xs text-[var(--color-text-secondary)]">
          Selected: {selected.name} ({Math.round(selected.size / 1024)} KB)
        </div>
      ) : null}

      {visibleError ? <p className="text-xs text-red-600">{visibleError}</p> : null}
    </div>
  );
}
