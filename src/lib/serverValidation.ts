type UnknownRecord = Record<string, unknown>;

export type ServerFieldErrors = Record<string, string>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function unwrapPayload(err: unknown): unknown {
  if (!isRecord(err)) return err;

  const candidate = err as UnknownRecord & {
    details?: unknown;
    response?: { data?: unknown };
    data?: unknown;
  };

  if (candidate.details) return candidate.details;
  if (candidate.response?.data) return candidate.response.data;
  if (candidate.data) return candidate.data;
  return err;
}

function normalizeMessage(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value;
  if (Array.isArray(value)) {
    const parts = value
      .map((item) => normalizeMessage(item))
      .filter((item): item is string => !!item);
    if (parts.length) return parts.join(', ');
  }
  if (isRecord(value) && typeof value.message === 'string' && value.message.trim()) {
    return value.message;
  }
  return null;
}

function extractErrors(payload: unknown): UnknownRecord | null {
  if (!isRecord(payload)) return null;

  if (isRecord(payload.errors)) return payload.errors;
  if (isRecord(payload.data) && isRecord(payload.data.errors)) return payload.data.errors;
  if (isRecord(payload.details) && isRecord(payload.details.errors)) return payload.details.errors;
  return null;
}

function normalizeFieldKey(key: string): string {
  if (key.startsWith('values.')) return key.slice('values.'.length);
  return key;
}

export function extractServerFieldErrors(err: unknown): ServerFieldErrors {
  const payload = unwrapPayload(err);
  const errors = extractErrors(payload);
  if (!errors) return {};

  const normalized: ServerFieldErrors = {};
  const collect = (bucket: UnknownRecord, prefix = '') => {
    for (const [rawKey, value] of Object.entries(bucket)) {
      const key = prefix ? `${prefix}.${rawKey}` : rawKey;
      const message = normalizeMessage(value);
      if (message) {
        normalized[normalizeFieldKey(key)] = message;
        continue;
      }
      if (isRecord(value)) {
        collect(value, key);
      }
    }
  };

  collect(errors);
  return normalized;
}

export function getServerErrorMessage(err: unknown, fallback = 'Request failed'): string {
  if (err instanceof Error && err.message) return err.message;

  const payload = unwrapPayload(err);
  if (isRecord(payload)) {
    const message = payload.message ?? payload.error;
    if (typeof message === 'string' && message.trim()) return message;
  }

  return fallback;
}

export function getFirstServerFieldError(errors: ServerFieldErrors): string | null {
  const first = Object.values(errors)[0];
  return first || null;
}
