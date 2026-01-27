import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = new Set(['/login', '/register']);

const ADMIN_DASHBOARD = '/dashboard';
const SUPER_DASHBOARD = '/dashboard/super';

const ALIAS_ADMIN = '/admin';
const ALIAS_SUPER = '/super';

function normalizePath(pathname: string): string {
  if (!pathname) return '/';
  if (pathname === '/') return '/';
  return pathname.replace(/\/+$/, '') || '/';
}

function isPublicPath(pathname: string): boolean {
  const normalized = normalizePath(pathname);
  if (PUBLIC_PATHS.has(normalized)) return true;
  for (const p of PUBLIC_PATHS) {
    if (normalized.startsWith(`${p}/`)) return true;
  }
  return false;
}

function normalizeRole(raw?: string | null): 'admin' | 'super_admin' | null {
  if (!raw || typeof raw !== 'string') return null;
  const normalized = raw.toLowerCase().replace(/\s+/g, '_');
  if (normalized === 'admin') return 'admin';
  if (normalized === 'super_admin') return 'super_admin';
  return null;
}

// Prefer cookie role; decode token ONLY if role cookie missing
function decodeRoleFromToken(token?: string): 'admin' | 'super_admin' | null {
  if (!token) return null;
  const [, payload] = token.split('.');
  if (!payload) return null;

  try {
    // Edge-safe base64url decode
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decoded = atob(padded);
    const data = JSON.parse(decoded);
    const role = data?.role ?? data?.user?.role ?? data?.claims?.role;
    return normalizeRole(role);
  } catch {
    return null;
  }
}

function getRole(req: NextRequest): 'admin' | 'super_admin' | null {
  const cookieRole =
    req.cookies.get('auth_role')?.value || req.cookies.get('user_role')?.value;

  const normalizedCookieRole = normalizeRole(cookieRole);
  if (normalizedCookieRole) return normalizedCookieRole;
  return decodeRoleFromToken(req.cookies.get('auth_token')?.value);
}

function mapAliasToCanonical(pathname: string): string | null {
  if (pathname === ALIAS_SUPER || pathname.startsWith(`${ALIAS_SUPER}/`)) {
    return SUPER_DASHBOARD + pathname.slice(ALIAS_SUPER.length);
  }
  if (pathname === ALIAS_ADMIN || pathname.startsWith(`${ALIAS_ADMIN}/`)) {
    return ADMIN_DASHBOARD + pathname.slice(ALIAS_ADMIN.length);
  }
  return null;
}

function redirectTo(req: NextRequest, pathname: string) {
  const url = req.nextUrl.clone();
  url.pathname = pathname;
  url.search = '';
  return NextResponse.redirect(url);
}

function rewriteTo(req: NextRequest, pathname: string) {
  const url = req.nextUrl.clone();
  url.pathname = pathname;
  return NextResponse.rewrite(url);
}

// Only set cookie if changed (critical perf fix)
function maybeSetRoleCookie(
  req: NextRequest,
  res: NextResponse,
  role: 'admin' | 'super_admin' | null
) {
  const current = req.cookies.get('auth_role')?.value || '';

  const next = role ?? '';
  if (current === next) return;

  if (role === 'admin' || role === 'super_admin') {
    res.cookies.set('auth_role', role, { path: '/', sameSite: 'lax' });
  } else {
    res.cookies.set('auth_role', '', { path: '/', maxAge: 0, sameSite: 'lax' });
  }
}

export function middleware(req: NextRequest) {
  const pathname = normalizePath(req.nextUrl.pathname);
  const search = req.nextUrl.searchParams;

  // Never touch API/proxy traffic
  if (pathname.startsWith('/api') || pathname.startsWith('/proxy')) {
    return NextResponse.next();
  }

  // Skip Next.js data/RSC fetches to avoid hanging renders
  if (
    pathname.startsWith('/_next/data') ||
    search.has('_rsc') ||
    search.has('__nextDataReq')
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get('auth_token')?.value;
  const role = getRole(req);

  const isSuperAdmin = role === 'super_admin';
  const isAdmin = role === 'admin';

  const preferredDashboard = isSuperAdmin ? SUPER_DASHBOARD : ADMIN_DASHBOARD;
  const isPublic = isPublicPath(pathname);

  // Alias -> canonical via REWRITE (fast, no extra hop)
  const canonical = mapAliasToCanonical(pathname);
  if (canonical && canonical !== pathname) {
    const res = rewriteTo(req, canonical);
    maybeSetRoleCookie(req, res, role);
    return res;
  }

  // Logged in hitting "/" -> redirect to dashboard
  if (token && pathname === '/') {
    const res = redirectTo(req, preferredDashboard);
    maybeSetRoleCookie(req, res, role);
    return res;
  }

  // Not logged in and not public -> redirect to login
  if (!token && !isPublic) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('redirect', pathname);
    const res = NextResponse.redirect(loginUrl);
    maybeSetRoleCookie(req, res, null);
    return res;
  }

  // Logged in trying to visit login/register -> redirect to dashboard
  if (token && (pathname === '/login' || pathname === '/register')) {
    const res = redirectTo(req, preferredDashboard);
    maybeSetRoleCookie(req, res, role);
    return res;
  }

  // Admin blocked from super routes
  if (pathname.startsWith(SUPER_DASHBOARD) && isAdmin) {
    const res = redirectTo(req, ADMIN_DASHBOARD);
    maybeSetRoleCookie(req, res, role);
    return res;
  }

  // Super admin blocked from admin subtree (except their own)
  if (isSuperAdmin && pathname.startsWith(ADMIN_DASHBOARD) && !pathname.startsWith(SUPER_DASHBOARD)) {
    const res = redirectTo(req, SUPER_DASHBOARD);
    maybeSetRoleCookie(req, res, role);
    return res;
  }

  const res = NextResponse.next();
  maybeSetRoleCookie(req, res, role);
  return res;
}

export const config = {
  matcher: [
    // Keep exclusions
    '/((?!api|proxy|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map)$).*)',
  ],
};
