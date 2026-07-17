import type { AuthRole } from '@/lib/authRole';

/**
 * Routes under /dashboard that belong to the operational "admin" role.
 * Role separation is intentional: super_admin owns the authority console
 * (/dashboard/super) only, admin owns everything else — this is the single
 * source of truth for that split. It was previously duplicated character-
 * for-character in both withAuth.tsx and dashboard/layout-client.tsx, with
 * no shared source, so a new route added to one list could silently be
 * missing from the other.
 */
export const ADMIN_ONLY_PREFIXES = [
  '/dashboard/event',
  '/dashboard/reels',
  '/dashboard/testimonials',
  '/dashboard/forms',
  '/dashboard/email-marketing',
  '/dashboard/newsletter',
  '/dashboard/registrations',
  '/dashboard/notifications',
  '/dashboard/content',
  '/dashboard/settings',
  '/dashboard/store',
  '/dashboard/administration',
  '/dashboard/leadership',
  '/dashboard/workforce',
  '/dashboard/new-members',
  '/dashboard/members',
  '/dashboard/analytics',
  '/dashboard/reports',
  '/dashboard/prayer-requests',
  '/dashboard/cell-groups',
  '/dashboard/ministries',
  '/dashboard/attendance',
  '/dashboard/giving',
] as const;

export function isSuperAdminPath(pathname: string): boolean {
  return pathname === '/dashboard/super' || pathname.startsWith('/dashboard/super/');
}

export function isAdminOnlyPath(pathname: string): boolean {
  if (pathname === '/dashboard') return true;
  return ADMIN_ONLY_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** Which role a /dashboard route requires, if any. */
export function getRequiredRoleForPath(pathname: string): AuthRole | undefined {
  if (isSuperAdminPath(pathname)) return 'super_admin';
  if (isAdminOnlyPath(pathname)) return 'admin';
  return undefined;
}
