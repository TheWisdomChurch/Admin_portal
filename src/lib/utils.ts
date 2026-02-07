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
const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL ?? '').replace(/\/+$/, '');

export function buildPublicFormUrl(slug?: string, publicUrl?: string): string | null {
  const base =
    PUBLIC_BASE_URL ||
    (typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '');

  let baseHost = '';
  try {
    if (base && /^https?:\/\//i.test(base)) baseHost = new URL(base).host;
  } catch {
    baseHost = '';
  }

  if (publicUrl) {
    const trimmed = publicUrl.trim();
    const lowered = trimmed.toLowerCase();
    let apiHost = '';
    try {
      if (API_ORIGIN) apiHost = new URL(API_ORIGIN).host;
    } catch {
      apiHost = '';
    }

    let publicHost = '';
    try {
      if (/^https?:\/\//i.test(trimmed)) publicHost = new URL(trimmed).host;
    } catch {
      publicHost = '';
    }

    const looksLikeApi =
      lowered.includes('/api/') ||
      lowered.includes('/api/v1') ||
      lowered.includes('/admin/') ||
      (apiHost && publicHost && apiHost === publicHost) ||
      (baseHost && publicHost && baseHost !== publicHost);

    if (!looksLikeApi) {
      if (trimmed.startsWith('/')) {
        return base ? `${base}${trimmed}` : trimmed;
      }
      if (/^https?:\/\//i.test(trimmed)) return trimmed;
    }
  }

  if (!slug) return null;
  const safeSlug = encodeURIComponent(slug);
  if (base) return `${base}/forms/${safeSlug}`;
  return `/forms/${safeSlug}`;
}
