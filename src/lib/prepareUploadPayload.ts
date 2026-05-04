import {
  assetUrl,
  uploadAsset,
  type UploadKind,
  type UploadedAssetResult,
} from '@/lib/uploads';

import type { SubmittedFormValue, UploadedFormAssetValue } from '@/lib/types';

export type UploadFieldDescriptor = {
  key: string;
  label?: string;
  type?: string;
  required?: boolean;
  validation?: {
    max?: number;
  };
};

export type UploadableValue =
  | string
  | boolean
  | number
  | string[]
  | UploadedFormAssetValue
  | File
  | null
  | undefined;

export type UploadableValues = Record<string, UploadableValue>;
export type SubmittedValues = Record<string, SubmittedFormValue>;

export type PrepareUploadPayloadOptions = {
  fields: UploadFieldDescriptor[];
  values: UploadableValues;
  module: string;
  ownerType?: string;
  ownerId?: string;
  slug?: string;
  folderPrefix?: string;
  addImageAliases?: boolean;
};

const DATA_URL_RE = /^data:([^;,]+);base64,/i;

function isDataUrl(value: unknown): value is string {
  return typeof value === 'string' && DATA_URL_RE.test(value.trim());
}

function isBrowserFile(value: unknown): value is File {
  return typeof File !== 'undefined' && value instanceof File;
}

async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();

  const contentType =
    blob.type || dataUrl.match(DATA_URL_RE)?.[1] || 'application/octet-stream';

  const rawExt = contentType.split('/')[1] || 'bin';
  const extension = rawExt.replace(/[^a-z0-9.+-]/gi, '') || 'bin';

  return new File([blob], `${filename}.${extension}`, {
    type: contentType,
  });
}

function normalizeFieldType(value?: string): string {
  return String(value || '').trim().toLowerCase();
}

export function isUploadFieldType(value?: string): boolean {
  const type = normalizeFieldType(value);

  return (
    type === 'image' ||
    type === 'file' ||
    type === 'upload' ||
    type === 'video' ||
    type === 'audio' ||
    type === 'document'
  );
}

function fieldText(field: UploadFieldDescriptor): string {
  return `${field.type || ''} ${field.key || ''} ${field.label || ''}`.toLowerCase();
}

export function inferUploadKindFromField(field: UploadFieldDescriptor): UploadKind {
  const hay = fieldText(field);

  if (/\b(image|photo|picture|passport|headshot|avatar|banner|thumbnail)\b/.test(hay)) {
    return 'image';
  }

  if (/\b(video|reel|mp4|mov|webm|clip)\b/.test(hay)) {
    return 'video';
  }

  if (/\b(audio|voice|sermon|mp3|m4a|wav|ogg)\b/.test(hay)) {
    return 'audio';
  }

  if (/\b(document|pdf|doc|docx|xls|xlsx|csv|resume|cv|attachment)\b/.test(hay)) {
    return 'document';
  }

  return 'file';
}

function inferUploadKindFromFilename(file: File): UploadKind {
  const name = file.name.toLowerCase();

  if (/\.(jpe?g|png|webp|gif|avif|svg)$/.test(name)) return 'image';
  if (/\.(mp4|mov|webm|avi|mkv)$/.test(name)) return 'video';
  if (/\.(mp3|m4a|wav|ogg|webm)$/.test(name)) return 'audio';
  if (/\.(pdf|txt|csv|doc|docx|xls|xlsx)$/.test(name)) return 'document';

  return 'file';
}

export function inferUploadKindFromFile(
  file: File,
  field?: UploadFieldDescriptor
): UploadKind {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';

  if (
    file.type === 'application/pdf' ||
    file.type.startsWith('text/') ||
    file.type.includes('word') ||
    file.type.includes('excel') ||
    file.type.includes('spreadsheet')
  ) {
    return 'document';
  }

  if (field) {
    const inferredFromField = inferUploadKindFromField(field);
    if (inferredFromField !== 'file') return inferredFromField;
  }

  return inferUploadKindFromFilename(file);
}

function sanitizePathSegment(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'general'
  );
}

function folderForUpload(
  options: PrepareUploadPayloadOptions,
  kind: UploadKind
): string {
  const prefix = sanitizePathSegment(options.folderPrefix || options.module || 'uploads');
  const slug = sanitizePathSegment(options.slug || options.ownerId || 'general');

  return `${prefix}/${slug}/${kind}s`;
}

function toUploadedFormAssetValue(uploaded: UploadedAssetResult): UploadedFormAssetValue {
  return {
    id: uploaded.id,
    assetId: uploaded.assetId,
    url: uploaded.url,
    publicUrl: uploaded.publicUrl || uploaded.url,
    public_url: uploaded.public_url,
    key: uploaded.key,
    objectKey: uploaded.objectKey,
    kind: uploaded.kind,
    contentType: uploaded.contentType,
    mimeType: uploaded.mimeType,
    sizeBytes: uploaded.sizeBytes,
    originalName: uploaded.originalName,
    provider: uploaded.provider,
    bucket: uploaded.bucket,
    checksum: uploaded.checksum,
    status: uploaded.status,
  };
}

function shouldAddImageAliases(key: string): boolean {
  const lowerKey = key.toLowerCase();

  return (
    lowerKey.includes('image') ||
    lowerKey.includes('photo') ||
    lowerKey.includes('passport') ||
    lowerKey.includes('picture') ||
    lowerKey.includes('headshot') ||
    lowerKey.includes('avatar') ||
    lowerKey.startsWith('field_')
  );
}

function assignImageAliases(
  output: SubmittedValues,
  key: string,
  url: string,
  enabled?: boolean
): void {
  if (!enabled || !shouldAddImageAliases(key)) return;

  output.imageUrl = url;
  output.image_url = url;
  output.photo = url;
}

export function assertNoEmbeddedDataUrls(values: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === 'string' && isDataUrl(value)) {
      throw new Error(`${key} still contains embedded base64 media. Upload failed before submission.`);
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === 'string' && isDataUrl(item)) {
          throw new Error(`${key}[${index}] still contains embedded base64 media. Upload failed before submission.`);
        }

        if (item && typeof item === 'object' && !Array.isArray(item)) {
          assertNoEmbeddedDataUrls(item as Record<string, unknown>);
        }
      });

      continue;
    }

    if (value && typeof value === 'object') {
      assertNoEmbeddedDataUrls(value as Record<string, unknown>);
    }
  }
}

export async function prepareUploadPayload({
  fields,
  values,
  module,
  ownerType,
  ownerId,
  slug,
  folderPrefix,
  addImageAliases,
}: PrepareUploadPayloadOptions): Promise<SubmittedValues> {
  const output: SubmittedValues = {};
  const fieldByKey = new Map(fields.map((field) => [field.key, field]));

  const options: PrepareUploadPayloadOptions = {
    fields,
    values,
    module,
    ownerType,
    ownerId,
    slug,
    folderPrefix,
    addImageAliases,
  };

  for (const [key, value] of Object.entries(values)) {
    const field = fieldByKey.get(key);
    const isConfiguredUploadField = field ? isUploadFieldType(field.type) : false;

    if (value == null) {
      if (!isConfiguredUploadField) {
        output[key] = null;
      }

      continue;
    }

    if (isBrowserFile(value)) {
      const kind = inferUploadKindFromFile(value, field);

      const uploaded = await uploadAsset(value, {
        kind,
        module,
        ownerType,
        ownerId,
        folder: folderForUpload(options, kind),
      });

      const url = uploaded.publicUrl || uploaded.url;
      output[key] = url;

      if (kind === 'image') {
        assignImageAliases(output, key, url, addImageAliases);
      }

      continue;
    }

    if (isDataUrl(value)) {
      const file = await dataUrlToFile(value, `${key}-${Date.now()}`);
      const kind = inferUploadKindFromFile(file, field);

      const uploaded = await uploadAsset(file, {
        kind,
        module,
        ownerType,
        ownerId,
        folder: folderForUpload(options, kind),
      });

      const uploadedAsset = toUploadedFormAssetValue(uploaded);
      const url = uploadedAsset.publicUrl || uploadedAsset.url;

      output[key] = url;

      if (kind === 'image') {
        assignImageAliases(output, key, url, addImageAliases);
      }

      continue;
    }

    if (Array.isArray(value)) {
      output[key] = value;
      continue;
    }

    if (typeof value === 'object') {
      const url = assetUrl(value);

      if (url) {
        output[key] = url;
      } else {
        output[key] = value;
      }

      continue;
    }

    output[key] = value;
  }

  assertNoEmbeddedDataUrls(output as Record<string, unknown>);

  return output;
}
