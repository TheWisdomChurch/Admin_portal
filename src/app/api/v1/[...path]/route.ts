import { NextRequest, NextResponse } from 'next/server';

const RAW_API_ORIGIN =
  process.env.API_PROXY_ORIGIN ??
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.NEXT_PUBLIC_BACKEND_URL;

function normalizeOrigin(raw?: string | null): string {
  if (!raw || !raw.trim()) {
    throw new Error('[api proxy] Missing API origin. Set API_PROXY_ORIGIN or NEXT_PUBLIC_API_URL.');
  }
  let base = raw.trim().replace(/\/+$/, '');
  if (base.endsWith('/api/v1')) base = base.slice(0, -'/api/v1'.length);
  return base;
}

// Ensure cookies become host-only for admin domain
function stripCookieDomain(cookie: string): string {
  return cookie.replace(/;\s*Domain=[^;]+/i, '');
}

// Optional: if your backend sets SameSite=Lax for auth cookies but you need cross-site,
// you can force SameSite=None; Secure here. Usually not needed because proxy is same-site.
// Uncomment only if needed.
// function forceSameSiteNone(cookie: string): string {
//   const hasSameSite = /;\s*SameSite=/i.test(cookie);
//   const withSameSite = hasSameSite ? cookie.replace(/;\s*SameSite=[^;]+/i, '; SameSite=None') : `${cookie}; SameSite=None`;
//   const hasSecure = /;\s*Secure/i.test(withSameSite);
//   return hasSecure ? withSameSite : `${withSameSite}; Secure`;
// }

async function proxy(req: NextRequest, pathSegments: string[]) {
  const origin = normalizeOrigin(RAW_API_ORIGIN);
  const target = new URL(`${origin}/api/v1/${pathSegments.join('/')}`);
  target.search = req.nextUrl.search;

  const method = req.method.toUpperCase();
  const body = method === 'GET' || method === 'HEAD' ? undefined : await req.arrayBuffer();

  const headers = new Headers(req.headers);

  // Remove headers that should not be forwarded
  headers.delete('host');
  headers.delete('content-length');
  headers.delete('origin'); // avoid confusing upstream CORS

  // Add forwarding headers (useful for logs / security)
  const ip = req.headers.get('x-forwarded-for') ?? '';
  if (ip) headers.set('x-forwarded-for', ip);
  if (!headers.get('x-forwarded-proto')) headers.set('x-forwarded-proto', 'https');
if (!headers.get('x-forwarded-host')) headers.set('x-forwarded-host', req.headers.get('host') ?? '');
  const upstream = await fetch(target, {
    method,
    headers,
    body,
    redirect: 'manual',
  });

  const responseHeaders = new Headers(upstream.headers);

  // Handle Set-Cookie (Node fetch exposes getSetCookie in undici)
  const getSetCookie = (upstream.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  const setCookies = getSetCookie ? getSetCookie.call(upstream.headers) : [];

  if (setCookies.length > 0) {
    responseHeaders.delete('set-cookie');
    for (const cookie of setCookies) {
      const cleaned = stripCookieDomain(cookie);
      responseHeaders.append('set-cookie', cleaned);
    }
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

type RouteContext = { params: { path?: string[] } };

export async function GET(req: NextRequest, context: RouteContext) {
  return proxy(req, context.params.path ?? []);
}
export async function POST(req: NextRequest, context: RouteContext) {
  return proxy(req, context.params.path ?? []);
}
export async function PUT(req: NextRequest, context: RouteContext) {
  return proxy(req, context.params.path ?? []);
}
export async function PATCH(req: NextRequest, context: RouteContext) {
  return proxy(req, context.params.path ?? []);
}
export async function DELETE(req: NextRequest, context: RouteContext) {
  return proxy(req, context.params.path ?? []);
}
export async function OPTIONS(req: NextRequest, context: RouteContext) {
  return proxy(req, context.params.path ?? []);
}
export async function HEAD(req: NextRequest, context: RouteContext) {
  return proxy(req, context.params.path ?? []);
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
