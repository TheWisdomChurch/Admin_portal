// src/lib/utils.ts
// Simple cn function without external dependencies
export function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatDateTime(date: string | Date) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function truncateText(text: string, length: number = 100) {
  if (text.length <= length) return text;
  return text.slice(0, length) + '...';
}

export function generateSlug(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .trim();
}

export function validateEmail(email: string) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

export function getInitials(name: string) {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function formatFileSize(bytes: number) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export const normalizeEmail = (value: string): string => value.trim().toLowerCase();

const PUBLIC_BASE_URL = (process.env.NEXT_PUBLIC_PUBLIC_URL ?? process.env.NEXT_PUBLIC_FRONTEND_URL ?? '').replace(/\/+$/, '');
const PUBLIC_FORM_SEGMENT = '/forms';

function resolvePublicBaseUrl(): string {
  if (PUBLIC_BASE_URL) return PUBLIC_BASE_URL;
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  return '';
}

function normalizeLegacyPublicFormPath(pathname: string): string {
  if (pathname === '/form') return PUBLIC_FORM_SEGMENT;
  if (pathname.startsWith('/form/')) {
    return `${PUBLIC_FORM_SEGMENT}/${pathname.slice('/form/'.length)}`;
  }
  return pathname;
}

function isBlockedPublicPath(pathname: string): boolean {
  return /^\/(?:api|admin)(?:\/|$)/i.test(pathname);
}

export function buildPublicFormPath(slug: string): string {
  return `${PUBLIC_FORM_SEGMENT}/${encodeURIComponent(slug)}`;
}

export function buildPublicFormUrl(slug?: string, publicUrl?: string): string | null {
  const base = resolvePublicBaseUrl();

  if (publicUrl) {
    const trimmed = publicUrl.trim();
    if (trimmed.startsWith('/')) {
      const normalizedPath = normalizeLegacyPublicFormPath(trimmed);
      if (!isBlockedPublicPath(normalizedPath)) {
        return base ? `${base}${normalizedPath}` : normalizedPath;
      }
    }

    if (/^https?:\/\//i.test(trimmed)) {
      try {
        const normalized = new URL(trimmed);
        normalized.pathname = normalizeLegacyPublicFormPath(normalized.pathname);
        if (!isBlockedPublicPath(normalized.pathname)) {
          return normalized.toString();
        }
      } catch {
        return null;
      }
    }
  }

  if (!slug) return null;
  const path = buildPublicFormPath(slug);
  return base ? `${base}${path}` : path;
}
