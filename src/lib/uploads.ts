import { apiClient } from './api';

export type UploadKind = 'image' | 'video' | 'audio' | 'document' | 'file';

export type UploadedAsset = {
  id?: string;
  assetId?: string;
  url: string;
  publicUrl: string;
  public_url?: string;
  key: string;
  objectKey: string;
  kind: UploadKind;
  module?: string;
  folder?: string;
  ownerType?: string;
  ownerId?: string;
  contentType: string;
  mimeType?: string;
  sizeBytes: number;
  originalName?: string;
  provider?: string;
  bucket?: string;
  checksum?: string;
  status?: string;
};

export type UploadAssetOptions = {
  kind?: UploadKind;
  module?: string;
  folder?: string;
  ownerType?: string;
  ownerId?: string;
};

export function inferUploadKind(file: File, hint = ''): UploadKind {
  const haystack = `${hint} ${file.type} ${file.name}`.toLowerCase();

  if (file.type.startsWith('image/') || /\b(image|photo|picture|avatar|passport|thumbnail|banner)\b/.test(haystack)) return 'image';
  if (file.type.startsWith('video/') || /\b(video|mp4|mov|webm|reel)\b/.test(haystack)) return 'video';
  if (file.type.startsWith('audio/') || /\b(audio|mp3|wav|m4a|sermon)\b/.test(haystack)) return 'audio';
  if (
    file.type === 'application/pdf' ||
    file.type.includes('word') ||
    file.type.includes('excel') ||
    file.type.includes('spreadsheet') ||
    file.type.startsWith('text/') ||
    /\b(document|pdf|doc|docx|xls|xlsx|csv|file|attachment|cv|resume)\b/.test(haystack)
  ) return 'document';

  return 'file';
}

export function normalizeUploadedAsset(raw: Partial<UploadedAsset>): UploadedAsset {
  const publicUrl = raw.publicUrl || raw.public_url || raw.url || '';
  const objectKey = raw.objectKey || raw.key || '';

  if (!publicUrl) throw new Error('Upload succeeded but no public URL was returned.');

  return {
    id: raw.id,
    assetId: raw.assetId,
    url: publicUrl,
    publicUrl,
    public_url: raw.public_url,
    key: raw.key || objectKey,
    objectKey,
    kind: raw.kind || 'file',
    module: raw.module,
    folder: raw.folder,
    ownerType: raw.ownerType,
    ownerId: raw.ownerId,
    contentType: raw.contentType || raw.mimeType || 'application/octet-stream',
    mimeType: raw.mimeType || raw.contentType,
    sizeBytes: Number(raw.sizeBytes || 0),
    originalName: raw.originalName,
    provider: raw.provider,
    bucket: raw.bucket,
    checksum: raw.checksum,
    status: raw.status,
  };
}

export async function uploadAsset(file: File, options: UploadAssetOptions = {}): Promise<UploadedAsset> {
  const kind = options.kind || inferUploadKind(file);
  const uploaded = await apiClient.uploadAsset(file, { ...options, kind });
  return normalizeUploadedAsset(uploaded as Partial<UploadedAsset>);
}

export function assetUrl(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value !== 'object') return '';
  const record = value as Record<string, unknown>;
  return String(record.publicUrl || record.public_url || record.url || '');
}
