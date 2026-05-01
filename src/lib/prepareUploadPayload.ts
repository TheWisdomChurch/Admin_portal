import {
  assetUrl,
  inferUploadKind,
  uploadAsset,
  type UploadKind,
} from '@/lib/uploads';
import type { UploadedFormAssetValue, SubmittedFormValue } from '@/lib/types';

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
  addLeadershipAliases?: boolean;
};

const DATA_URL_RE = /^data:([^;,]+);base64,/i;

function isDataUrl(value: unknown): value is string {
  return typeof value === 'string' && DATA_URL_RE.test(value.trim());
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

  if (/\b(audio|voice|sermon|mp3|m4a|wav)\b/.test(hay)) {
    return 'audio';
  }

  if (/\b(document|pdf|doc|docx|xls|xlsx|csv|resume|cv|attachment)\b/.test(hay)) {
    return 'document';
  }

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

  return field ? inferUploadKindFromField(field) : inferUploadKind(file);
}

function sanitizePathSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function folderForUpload(
  options: PrepareUploadPayloadOptions,
  field: UploadFieldDescriptor,
  kind: UploadKind
): string {
  const prefix = sanitizePathSegment(options.folderPrefix || options.module || 'uploads');
  const slug = sanitizePathSegment(options.slug || options.ownerId || 'general');
  const kindFolder = `${kind}s`;

  return `${prefix}/${slug}/${kindFolder}`;
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

export async function prepareUploadPayload({
  fields,
  values,
  module,
  ownerType,
  ownerId,
  slug,
  folderPrefix,
  addLeadershipAliases,
}: PrepareUploadPayloadOptions): Promise<SubmittedValues> {
  const output: SubmittedValues = {};
  const fieldByKey = new Map(fields.map((field) => [field.key, field]));

  for (const [key, value] of Object.entries(values)) {
    const field = fieldByKey.get(key);
    const isConfiguredUploadField = field ? isUploadFieldType(field.type) : false;

    if (value == null) {
      output[key] = null;
      continue;
    }

    if (value instanceof File) {
      const kind = inferUploadKindFromFile(value, field);
      const uploaded = await uploadAsset(value, {
        kind,
        module,
        ownerType,
        ownerId,
        folder: folderForUpload(
          { fields, values, module, ownerType, ownerId, slug, folderPrefix },
          field || { key, type: kind },
          kind
        ),
      });

      const url = uploaded.publicUrl || uploaded.url;
      output[key] = url;

      if (kind === 'image') {
        assignImageAliases(output, key, url, addLeadershipAliases);
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
        folder: folderForUpload(
          { fields, values, module, ownerType, ownerId, slug, folderPrefix },
          field || { key, type: kind },
          kind
        ),
      });

      const url = uploaded.publicUrl || uploaded.url;
      output[key] = url;

      if (kind === 'image') {
        assignImageAliases(output, key, url, addLeadershipAliases);
      }

      continue;
    }

    if (typeof value === 'object') {
      const url = assetUrl(value);

      if (url) {
        output[key] = url;
      } else {
        output[key] = value as UploadedFormAssetValue;
      }

      continue;
    }

    if (
      typeof value === 'string' ||
      typeof value === 'boolean' ||
      typeof value === 'number' ||
      Array.isArray(value)
    ) {
      output[key] = value;
      continue;
    }

    if (isConfiguredUploadField) {
      output[key] = null;
    }
  }

  return output;
}
