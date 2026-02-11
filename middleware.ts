import { NextRequest, NextResponse } from 'next/server';

const ADMIN_DASHBOARD = '/dashboard';
const SUPER_DASHBOARD = '/dashboard/super';
const ALIAS_ADMIN = '/admin';
const ALIAS_SUPER = '/super';

function normalizePath(pathname: string): string {
  if (!pathname) return '/';
  if (pathname === '/') return '/';
  return pathname.replace(/\/+$/, '') || '/';
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

export function middleware(req: NextRequest) {
  const pathname = normalizePath(req.nextUrl.pathname);
  const search = req.nextUrl.searchParams;

  // Never touch API/proxy traffic
  if (pathname.startsWith('/api') || pathname.startsWith('/proxy')) {
    return NextResponse.next();
  }

  // Skip Next.js data/RSC fetches to avoid hanging renders
  if (pathname.startsWith('/_next/data') || search.has('_rsc') || search.has('__nextDataReq')) {
    return NextResponse.next();
  }

  // Alias -> canonical via REWRITE
  const canonical = mapAliasToCanonical(pathname);
  if (canonical && canonical !== pathname) {
    return rewriteTo(req, canonical);
  }

  // Optional redirect: if auth cookie exists and user visits "/", send to dashboard
  const token = req.cookies.get('auth_token')?.value;
  if (token && pathname === '/') {
    return redirectTo(req, ADMIN_DASHBOARD);
  }

  // Do NOT enforce auth at middleware level.
  // Client-side AuthProvider will call /api/v1/auth/me and decide what to do.
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|proxy|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map)$).*)',
  ],
};
