'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  inferUploadKindFromFile,
  inferUploadKindFromField,
  type UploadFieldDescriptor,
} from '@/lib/prepareUploadPayload';
import type { UploadKind } from '@/lib/uploads';
import { ImageCropModal } from '@/components/ImageCropModal';

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

const defaultInputClass =
  'w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)]';

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
  required = false,
  disabled = false,
  error,
  className,
  onChange,
}: MediaUploadFieldProps): React.ReactElement {
  const [localError, setLocalError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // The file the admin originally picked, retained across a confirmed crop
  // so "Adjust crop" can re-open against it instead of re-cropping the
  // already-cropped output (which would compound quality loss each time).
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [cropObjectUrl, setCropObjectUrl] = useState<string | null>(null);
  const [cropModalOpen, setCropModalOpen] = useState(false);

  useEffect(() => {
    return () => {
      if (cropObjectUrl) URL.revokeObjectURL(cropObjectUrl);
    };
  }, [cropObjectUrl]);

  const selected = value instanceof File ? value : null;

  const kind = selected
    ? inferUploadKindFromFile(selected, field)
    : inferUploadKindFromField(field);

  const maxMb = getUploadLimitMb(field, kind);
  const visibleError = error || localError;

  const startCrop = (file: File) => {
    const url = URL.createObjectURL(file);
    setOriginalFile(file);
    setCropObjectUrl(url);
    setCropModalOpen(true);
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0] ?? null;

    if (!file) {
      setLocalError('');
      setOriginalFile(null);
      onChange(null);
      return;
    }

    const validationError = validateMediaFile(field, file);

    if (validationError) {
      event.currentTarget.value = '';
      setLocalError(validationError);
      setOriginalFile(null);
      onChange(null);
      return;
    }

    setLocalError('');

    const fileKind = inferUploadKindFromFile(file, field);
    if (fileKind === 'image' && field.aspectRatioKey) {
      // Don't stage the raw file yet — the crop is mandatory for fields
      // that declare a target ratio, so onChange only fires once a crop is
      // confirmed. This guarantees the uncropped original never uploads.
      startCrop(file);
      return;
    }

    setOriginalFile(null);
    onChange(file);
  };

  const handleCropConfirm = (blob: Blob) => {
    if (!originalFile) return;

    const croppedFile = new File([blob], originalFile.name, {
      type: blob.type,
      lastModified: Date.now(),
    });

    setCropModalOpen(false);
    if (cropObjectUrl) URL.revokeObjectURL(cropObjectUrl);
    setCropObjectUrl(null);
    onChange(croppedFile);
  };

  const handleCropCancel = () => {
    setCropModalOpen(false);
    if (cropObjectUrl) URL.revokeObjectURL(cropObjectUrl);
    setCropObjectUrl(null);
    setOriginalFile(null);
    if (inputRef.current) inputRef.current.value = '';
    onChange(null);
  };

  const handleAdjustCrop = () => {
    if (!originalFile) return;
    startCrop(originalFile);
  };

  const showAdjustCrop = Boolean(
    field.aspectRatioKey && selected && originalFile && !cropModalOpen
  );

  return React.createElement(
    'div',
    { className: 'space-y-2' },

    field.label
      ? React.createElement(
          'label',
          {
            className:
              'block text-sm font-medium text-[var(--color-text-secondary)]',
          },
          field.label,
          required
            ? React.createElement(
                'span',
                { className: 'ml-1 text-red-600' },
                '*'
              )
            : null
        )
      : null,

    React.createElement('input', {
      ref: inputRef,
      type: 'file',
      accept: getUploadAccept(kind),
      disabled,
      required,
      className: className || defaultInputClass,
      onChange: handleChange,
    }),

    React.createElement(
      'div',
      { className: 'text-xs text-[var(--color-text-tertiary)]' },
      `Accepted formats: ${getUploadFormatLabel(kind)}. Max ${maxMb}MB.`
    ),

    selected
      ? React.createElement(
          'div',
          {
            className:
              'flex items-center gap-2 text-xs text-[var(--color-text-secondary)]',
          },
          `Selected: ${selected.name} (${Math.round(selected.size / 1024)} KB)`,
          showAdjustCrop
            ? React.createElement(
                'button',
                {
                  type: 'button',
                  onClick: handleAdjustCrop,
                  className:
                    'font-medium text-[var(--color-accent-primary)] hover:underline',
                },
                'Adjust crop'
              )
            : null
        )
      : null,

    visibleError
      ? React.createElement(
          'p',
          { className: 'text-xs text-red-600' },
          visibleError
        )
      : null,

    field.aspectRatioKey && cropModalOpen && cropObjectUrl
      ? React.createElement(ImageCropModal, {
          key: 'crop-modal',
          open: cropModalOpen,
          imageSrc: cropObjectUrl,
          sourceType: originalFile?.type || 'image/jpeg',
          aspectRatioKey: field.aspectRatioKey,
          onCancel: handleCropCancel,
          onConfirm: handleCropConfirm,
        })
      : null
  );
}
