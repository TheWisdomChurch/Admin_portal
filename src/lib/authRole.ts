import type { User } from '@/lib/types';

export type AuthRole = 'admin' | 'super_admin';

export function normalizeAuthRole(raw: unknown): AuthRole | null {
  if (typeof raw !== 'string') return null;
  const normalized = raw
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '_');

  if (normalized === 'admin') return 'admin';
  if (normalized === 'super_admin' || normalized === 'superadmin') return 'super_admin';
  return null;
}

export function getUserRole(user: User | null | undefined): AuthRole | null {
  return normalizeAuthRole((user as { role?: unknown } | null | undefined)?.role);
}

