import type { UploadedFormAssetValue } from '@/lib/types';

export type UploadKind = 'image' | 'video' | 'audio' | 'document' | 'file';

export type UploadAssetOptions = {
  kind?: UploadKind;
  module?: string;
  ownerType?: string;
  ownerId?: string;
  folder?: string;
};

export type UploadedAssetResult = UploadedFormAssetValue & {
  id?: string;
  assetId?: string;
  url: string;
  publicUrl?: string;
  public_url?: string;
  key?: string;
  objectKey?: string;
  bucket?: string;
  provider?: string;
  contentType?: string;
  mimeType?: string;
  sizeBytes?: number;
  originalName?: string;
  status?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function unwrapApiData(value: unknown): unknown {
  if (!isRecord(value)) return value;

  const nested = value.data;
  if (isRecord(nested)) return nested;

  return value;
}

export function assetUrl(value: unknown): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return isHttpUrl(trimmed) ? trimmed : '';
  }

  if (!isRecord(value)) return '';

  const record = unwrapApiData(value);
  if (!isRecord(record)) return '';

  const candidates = [
    'publicUrl',
    'public_url',
    'url',
    'imageUrl',
    'image_url',
    'photoUrl',
    'photo_url',
    'src',
  ];

  for (const key of candidates) {
    const candidate = readString(record, key);
    if (candidate && isHttpUrl(candidate)) return candidate;
  }

  return '';
}

function normalizeKind(kind?: UploadKind): UploadKind {
  if (kind === 'image' || kind === 'video' || kind === 'audio' || kind === 'document' || kind === 'file') {
    return kind;
  }

  return 'file';
}

function getUploadEndpoint(kind: UploadKind): string {
  if (kind === 'image') return '/api/v1/uploads/images';
  return '/api/v1/uploads/files';
}

function appendOptional(form: FormData, key: string, value: string | undefined): void {
  const clean = value?.trim();
  if (clean) form.append(key, clean);
}

function normalizeUploadedAsset(raw: unknown, fallbackKind: UploadKind, fallbackFile: File): UploadedAssetResult {
  const unwrapped = unwrapApiData(raw);

  if (!isRecord(unwrapped)) {
    throw new Error('Upload succeeded but returned an invalid response.');
  }

  const url = assetUrl(unwrapped);
  if (!url) {
    throw new Error('Upload succeeded but no public URL was returned.');
  }

  return {
    id: readString(unwrapped, 'id'),
    assetId: readString(unwrapped, 'assetId') || readString(unwrapped, 'asset_id'),
    url,
    publicUrl: readString(unwrapped, 'publicUrl') || url,
    public_url: readString(unwrapped, 'public_url'),
    key: readString(unwrapped, 'key'),
    objectKey: readString(unwrapped, 'objectKey') || readString(unwrapped, 'object_key'),
    bucket: readString(unwrapped, 'bucket'),
    provider: readString(unwrapped, 'provider'),
    kind: (readString(unwrapped, 'kind') as UploadKind | undefined) || fallbackKind,
    contentType: readString(unwrapped, 'contentType') || readString(unwrapped, 'content_type') || fallbackFile.type,
    mimeType: readString(unwrapped, 'mimeType') || readString(unwrapped, 'mime_type') || fallbackFile.type,
    sizeBytes: readNumber(unwrapped, 'sizeBytes') || readNumber(unwrapped, 'size_bytes') || fallbackFile.size,
    originalName: readString(unwrapped, 'originalName') || readString(unwrapped, 'original_name') || fallbackFile.name,
    status: readString(unwrapped, 'status') || 'ready',
  };
}

async function readUploadError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as unknown;

    if (isRecord(body)) {
      const message =
        readString(body, 'message') ||
        readString(body, 'error') ||
        readString(body, 'detail');

      if (message) return message;
    }
  } catch {
    // Ignore JSON parse failure and fall back below.
  }

  return `Upload failed with status ${response.status}`;
}

export async function uploadAsset(file: File, options: UploadAssetOptions = {}): Promise<UploadedAssetResult> {
  if (!(file instanceof File)) {
    throw new Error('A valid file is required for upload.');
  }

  const kind = normalizeKind(options.kind);
  const form = new FormData();

  form.append('file', file);
  form.append('kind', kind);

  appendOptional(form, 'module', options.module);
  appendOptional(form, 'ownerType', options.ownerType);
  appendOptional(form, 'ownerId', options.ownerId);
  appendOptional(form, 'folder', options.folder);

  const response = await fetch(getUploadEndpoint(kind), {
    method: 'POST',
    body: form,
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(await readUploadError(response));
  }

  const raw = (await response.json()) as unknown;
  return normalizeUploadedAsset(raw, kind, file);
}

export async function uploadImage(file: File, options: Omit<UploadAssetOptions, 'kind'> = {}): Promise<UploadedAssetResult> {
  return uploadAsset(file, { ...options, kind: 'image' });
}

export async function uploadFile(file: File, options: UploadAssetOptions = {}): Promise<UploadedAssetResult> {
  return uploadAsset(file, { ...options, kind: options.kind ?? 'file' });
}
