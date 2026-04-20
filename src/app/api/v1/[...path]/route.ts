import { NextRequest, NextResponse } from 'next/server';

const RAW_API_ORIGIN =
  process.env.API_PROXY_ORIGIN ??
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.NEXT_PUBLIC_BACKEND_URL ??
  process.env.APP_PUBLIC_URL ??
  (process.env.API_DOMAIN ? `https://${process.env.API_DOMAIN}` : undefined);

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

function pickForwardHeaders(req: NextRequest): Headers {
  const headers = new Headers();
  const passthrough = [
    'accept',
    'accept-language',
    'cache-control',
    'content-type',
    'if-none-match',
    'if-modified-since',
    'pragma',
    'authorization',
    'cookie',
    'user-agent',
  ];

  for (const key of passthrough) {
    const value = req.headers.get(key);
    if (value) headers.set(key, value);
  }

  const host = req.headers.get('host');
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) headers.set('x-forwarded-for', forwardedFor);
  if (host) headers.set('x-forwarded-host', host);
  headers.set('x-forwarded-proto', req.nextUrl.protocol.replace(':', '') || 'https');

  const requestId = req.headers.get('x-request-id');
  if (requestId) headers.set('x-request-id', requestId);

  return headers;
}

function isHopByHopHeader(key: string) {
  const lower = key.toLowerCase();
  return (
    lower === 'connection' ||
    lower === 'keep-alive' ||
    lower === 'proxy-authenticate' ||
    lower === 'proxy-authorization' ||
    lower === 'te' ||
    lower === 'trailer' ||
    lower === 'transfer-encoding' ||
    lower === 'upgrade'
  );
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
  const headers = pickForwardHeaders(req);

  const controller = new AbortController();
  const timeoutMs = 15000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method,
      headers,
      body,
      redirect: 'manual',
      signal: controller.signal,
    });
  } catch {
    return NextResponse.json(
      { message: 'Upstream API request failed', statusCode: 502 },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeoutId);
  }

  const responseHeaders = new Headers();
  for (const [key, value] of upstream.headers.entries()) {
    if (isHopByHopHeader(key)) continue;
    if (key.toLowerCase() === 'set-cookie') continue;
    responseHeaders.set(key, value);
  }

  responseHeaders.set('x-content-type-options', 'nosniff');
  responseHeaders.set('x-frame-options', 'DENY');
  responseHeaders.set('referrer-policy', 'strict-origin-when-cross-origin');

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
