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

const DEFAULT_LOCAL_API_ORIGIN = 'http://localhost:8080';
const DEFAULT_PROD_API_ORIGIN = 'https://api.wisdomchurchhq.org';

function normalizeApiOrigin(raw?: string | null): string {
  const isProd = process.env.NODE_ENV === 'production';

  if (!raw || !raw.trim()) {
    return isProd ? DEFAULT_PROD_API_ORIGIN : DEFAULT_LOCAL_API_ORIGIN;
  }

  let base = raw.trim().replace(/\/+$/, '');
  if (base.endsWith('/api/v1')) {
    base = base.slice(0, -'/api/v1'.length);
  }

  return base;
}

function apiUrl(path: string): string {
  const useProxy = process.env.NEXT_PUBLIC_API_PROXY !== 'false';

  if (useProxy) {
    return path.startsWith('/') ? path : `/${path}`;
  }

  const origin = normalizeApiOrigin(
    process.env.NEXT_PUBLIC_UPLOAD_BASE_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      process.env.NEXT_PUBLIC_BACKEND_URL
  );

  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}

export function inferUploadKind(file: File, hint = ''): UploadKind {
  const haystack = `${hint} ${file.type} ${file.name}`.toLowerCase();

  if (
    file.type.startsWith('image/') ||
    /\b(image|photo|picture|avatar|passport|headshot|thumbnail|banner)\b/.test(haystack)
  ) {
    return 'image';
  }

  if (
    file.type.startsWith('video/') ||
    /\b(video|mp4|mov|webm|reel|clip)\b/.test(haystack)
  ) {
    return 'video';
  }

  if (
    file.type.startsWith('audio/') ||
    /\b(audio|mp3|wav|m4a|sermon|voice)\b/.test(haystack)
  ) {
    return 'audio';
  }

  if (
    file.type === 'application/pdf' ||
    file.type.includes('word') ||
    file.type.includes('excel') ||
    file.type.includes('spreadsheet') ||
    file.type.startsWith('text/') ||
    /\b(document|pdf|doc|docx|xls|xlsx|csv|attachment|cv|resume)\b/.test(haystack)
  ) {
    return 'document';
  }

  return 'file';
}

function unwrapUploadPayload(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== 'object') return {};

  const record = payload as Record<string, unknown>;

  if (record.data && typeof record.data === 'object') {
    return unwrapUploadPayload(record.data);
  }

  return record;
}

export function assetUrl(value: unknown): string {
  if (!value) return '';

  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value !== 'object') {
    return '';
  }

  const record = value as Record<string, unknown>;

  return String(
    record.publicUrl ||
      record.public_url ||
      record.url ||
      record.imageUrl ||
      record.image_url ||
      ''
  ).trim();
}

export function normalizeUploadedAsset(rawPayload: unknown): UploadedAsset {
  const raw = unwrapUploadPayload(rawPayload);

  const publicUrl = assetUrl(raw);
  const objectKey = String(raw.objectKey || raw.object_key || raw.key || '').trim();

  if (!publicUrl) {
    throw new Error('Upload succeeded but no public URL was returned.');
  }

  return {
    id: typeof raw.id === 'string' ? raw.id : undefined,
    assetId: typeof raw.assetId === 'string' ? raw.assetId : undefined,
    url: publicUrl,
    publicUrl,
    public_url: typeof raw.public_url === 'string' ? raw.public_url : undefined,
    key: String(raw.key || objectKey || publicUrl),
    objectKey,
    kind:
      raw.kind === 'image' ||
      raw.kind === 'video' ||
      raw.kind === 'audio' ||
      raw.kind === 'document' ||
      raw.kind === 'file'
        ? raw.kind
        : 'file',
    module: typeof raw.module === 'string' ? raw.module : undefined,
    folder: typeof raw.folder === 'string' ? raw.folder : undefined,
    ownerType: typeof raw.ownerType === 'string' ? raw.ownerType : undefined,
    ownerId: typeof raw.ownerId === 'string' ? raw.ownerId : undefined,
    contentType:
      typeof raw.contentType === 'string'
        ? raw.contentType
        : typeof raw.content_type === 'string'
          ? raw.content_type
          : typeof raw.mimeType === 'string'
            ? raw.mimeType
            : typeof raw.mime_type === 'string'
              ? raw.mime_type
              : 'application/octet-stream',
    mimeType:
      typeof raw.mimeType === 'string'
        ? raw.mimeType
        : typeof raw.mime_type === 'string'
          ? raw.mime_type
          : typeof raw.contentType === 'string'
            ? raw.contentType
            : typeof raw.content_type === 'string'
              ? raw.content_type
              : undefined,
    sizeBytes: Number(raw.sizeBytes || raw.size_bytes || 0),
    originalName:
      typeof raw.originalName === 'string'
        ? raw.originalName
        : typeof raw.original_name === 'string'
          ? raw.original_name
          : undefined,
    provider: typeof raw.provider === 'string' ? raw.provider : undefined,
    bucket: typeof raw.bucket === 'string' ? raw.bucket : undefined,
    checksum: typeof raw.checksum === 'string' ? raw.checksum : undefined,
    status: typeof raw.status === 'string' ? raw.status : undefined,
  };
}

export async function uploadAsset(
  file: File,
  options: UploadAssetOptions = {}
): Promise<UploadedAsset> {
  const kind = options.kind || inferUploadKind(file);

  const form = new FormData();
  form.append('file', file);
  form.append('kind', kind);
  form.append('module', options.module || 'uploads');

  if (options.folder?.trim()) form.append('folder', options.folder.trim());
  if (options.ownerType?.trim()) form.append('ownerType', options.ownerType.trim());
  if (options.ownerId?.trim()) form.append('ownerId', options.ownerId.trim());

  const response = await fetch(apiUrl('/api/v1/uploads'), {
    method: 'POST',
    body: form,
    credentials: 'include',
    cache: 'no-store',
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : { message: await response.text().catch(() => '') };

  if (!response.ok) {
    const message =
      payload?.error ||
      payload?.message ||
      `Upload failed with status ${response.status}`;

    throw new Error(message);
  }

  return normalizeUploadedAsset(payload);
}

export async function uploadAndReturnUrl(
  file: File,
  options: UploadAssetOptions = {}
): Promise<string> {
  const uploaded = await uploadAsset(file, options);
  return uploaded.publicUrl || uploaded.url;
}