import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = new Set(['/login', '/register']);
const ADMIN_DASHBOARD = '/dashboard';
const SUPER_DASHBOARD = '/dashboard/super';

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

function decodeRoleFromToken(token?: string): 'admin' | 'super_admin' | null {
  if (!token) return null;
  const [, payload] = token.split('.');
  if (!payload) return null;

  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decoded = atob(padded);
    const data = JSON.parse(decoded);
    const role = data?.role ?? data?.user?.role ?? data?.claims?.role;
    return role === 'super_admin' || role === 'admin' ? role : null;
  } catch {
    return null;
  }
}

function redirectTo(req: NextRequest, pathname: string) {
  const url = req.nextUrl.clone();
  url.pathname = pathname;
  url.search = '';
  return NextResponse.redirect(url);
}

export function middleware(req: NextRequest) {
  const pathname = normalizePath(req.nextUrl.pathname);

  const token = req.cookies.get('auth_token')?.value;
  const role = decodeRoleFromToken(token);
  const preferredDashboard = role === 'super_admin' ? SUPER_DASHBOARD : ADMIN_DASHBOARD;
  const isPublic = isPublicPath(pathname);

  // Authenticated user landing on "/" -> send to their dashboard
  if (token && pathname === '/') {
    return redirectTo(req, preferredDashboard);
  }

  // Unauthenticated user trying to access protected routes
  if (!token && !isPublic) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated user visiting auth pages => go to their dashboard
  if (token && (pathname === '/login' || pathname === '/register')) {
    return redirectTo(req, preferredDashboard);
  }

  // Admins should not access super-admin routes
  if (pathname.startsWith(SUPER_DASHBOARD) && role !== 'super_admin') {
    return redirectTo(req, ADMIN_DASHBOARD);
  }

  // Super admins hitting the admin dashboard should be routed to theirs
  if (role === 'super_admin' && pathname === ADMIN_DASHBOARD) {
    return redirectTo(req, SUPER_DASHBOARD);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map)$).*)',
  ],
};
