import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ path?: string[] }> | { path?: string[] };
};

type HeadersWithCookieHelpers = Headers & {
  getSetCookie?: () => string[];
  raw?: () => Record<string, string[]>;
};

const HOP_BY_HOP_HEADERS = new Set([
  'host',
  'connection',
  'content-length',
  'transfer-encoding',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'upgrade',
]);

// This route is a security boundary. Never pass arbitrary browser-controlled
// headers to the internal API: doing so would allow callers to spoof identity,
// forwarding, tracing, or infrastructure-only headers understood by the API.
const FORWARDED_REQUEST_HEADERS = new Set([
  'accept',
  'accept-language',
  'authorization',
  'content-type',
  'cookie',
  'if-match',
  'if-none-match',
  'idempotency-key',
  'origin',
  'range',
  'referer',
  'user-agent',
  'x-csrf-token',
  'x-request-id',
]);

const configuredCsrfHeader = process.env.CSRF_HEADER_NAME?.trim().toLowerCase();
if (configuredCsrfHeader && /^[a-z0-9-]{1,64}$/.test(configuredCsrfHeader)) {
  FORWARDED_REQUEST_HEADERS.add(configuredCsrfHeader);
}

function getTrustedPublicOrigin(): URL | null {
  const raw = process.env.ADMIN_PUBLIC_ORIGIN || process.env.NEXT_PUBLIC_SITE_URL || '';
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:' || process.env.NODE_ENV !== 'production' ? parsed : null;
  } catch {
    return null;
  }
}

function getBackendBaseURL(): string {
  const raw =
    process.env.API_INTERNAL_URL ||
    process.env.BACKEND_INTERNAL_URL ||
    process.env.API_BASE_URL ||
    process.env.API_PROXY_ORIGIN ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    'http://api:8080';

  return raw.trim().replace(/\/+$/, '').replace(/\/api\/v1$/i, '');
}

function buildTargetURL(request: NextRequest, pathParts: string[]): string {
  const safePath = pathParts.map((part) => encodeURIComponent(part)).join('/');
  const url = new URL(`/api/v1/${safePath}`, getBackendBaseURL());
  url.search = request.nextUrl.search;
  return url.toString();
}

function buildForwardHeaders(request: NextRequest): Headers {
  const headers = new Headers();

  request.headers.forEach((value, key) => {
    const lower = key.toLowerCase();

    if (HOP_BY_HOP_HEADERS.has(lower) || !FORWARDED_REQUEST_HEADERS.has(lower)) {
      return;
    }

    headers.set(key, value);
  });

  // x-forwarded-* values supplied by the browser are deliberately discarded.
  // The reverse proxy/API gateway owns client-IP attribution and must append it
  // at the trusted infrastructure boundary.
  const publicOrigin = getTrustedPublicOrigin();
  if (publicOrigin) {
    headers.set('x-forwarded-host', publicOrigin.host);
    headers.set('x-forwarded-proto', publicOrigin.protocol.replace(':', ''));
  } else {
    headers.set('x-forwarded-proto', request.nextUrl.protocol.replace(':', '') || 'https');
  }

  return headers;
}

function splitCombinedSetCookieHeader(value: string): string[] {
  const cookies: string[] = [];
  let start = 0;

  for (let i = 0; i < value.length; i += 1) {
    if (value[i] !== ',') continue;

    const rest = value.slice(i + 1);

    // Split only when the comma is followed by another cookie-name=.
    // This avoids splitting inside Expires=Wed, 21 Oct 2015...
    if (/^\s*[!#$%&'*+\-.^_`|~0-9A-Za-z]+=/.test(rest)) {
      const part = value.slice(start, i).trim();
      if (part) cookies.push(part);
      start = i + 1;
    }
  }

  const last = value.slice(start).trim();
  if (last) cookies.push(last);

  return cookies;
}

function getSetCookieHeaders(upstreamHeaders: Headers): string[] {
  const headers = upstreamHeaders as HeadersWithCookieHelpers;

  if (typeof headers.getSetCookie === 'function') {
    const values = headers.getSetCookie().filter(Boolean);
    if (values.length > 0) return values;
  }

  if (typeof headers.raw === 'function') {
    const raw = headers.raw()['set-cookie'];
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.filter(Boolean);
    }
  }

  const merged = upstreamHeaders.get('set-cookie');
  return merged ? splitCombinedSetCookieHeader(merged) : [];
}

function buildResponseHeaders(upstreamHeaders: Headers): Headers {
  const headers = new Headers();
  const setCookieHeaders = getSetCookieHeaders(upstreamHeaders);

  upstreamHeaders.forEach((value, key) => {
    const lower = key.toLowerCase();

    if (
      lower === 'connection' ||
      lower === 'content-length' ||
      lower === 'transfer-encoding' ||
      lower === 'content-encoding' ||
      lower === 'set-cookie'
    ) {
      return;
    }

    headers.set(key, value);
  });

  for (const cookie of setCookieHeaders) {
    headers.append('set-cookie', cookie);
  }

  headers.set('cache-control', 'no-store');
  headers.set('x-admin-api-proxy', 'true');

  return headers;
}

function readRequestBody(
  request: NextRequest,
  method: string
): ReadableStream<Uint8Array> | null | undefined {
  if (method === 'GET' || method === 'HEAD') {
    return undefined;
  }

  return request.body;
}

async function proxy(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const params = await context.params;
  const pathParts = Array.isArray(params.path) ? params.path : [];
  const method = request.method.toUpperCase();
  const targetURL = buildTargetURL(request, pathParts);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180_000);

  try {
    const body = readRequestBody(request, method);

    const init: RequestInit & { duplex?: 'half' } = {
      method,
      headers: buildForwardHeaders(request),
      body,
      redirect: 'manual',
      cache: 'no-store',
      signal: controller.signal,
    };

    if (body) {
      init.duplex = 'half';
    }

    const upstream = await fetch(targetURL, init);

    const responseHeaders = buildResponseHeaders(upstream.headers);
    const responseBody = await upstream.arrayBuffer();

    if (upstream.status >= 500) {
      console.error('[admin-api-proxy] upstream returned error', {
        method,
        path: request.nextUrl.pathname,
        status: upstream.status,
        statusText: upstream.statusText,
      });
    }

    return new NextResponse(responseBody, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown proxy error';

    console.error('[admin-api-proxy] upstream request failed', {
      method,
      targetURL,
      backendBaseURL: getBackendBaseURL(),
      message,
    });

    return NextResponse.json(
      {
        error: 'Bad Gateway',
        message: 'Admin could not reach the application service.',
        detail: process.env.NODE_ENV === 'production' ? undefined : message,
      },
      {
        status: 502,
        headers: {
          'cache-control': 'no-store',
          'x-admin-api-proxy': 'true',
          'x-admin-api-proxy-error': 'network',
        },
      }
    );
  } finally {
    clearTimeout(timeout);
  }
}

export {
  proxy as GET,
  proxy as POST,
  proxy as PUT,
  proxy as PATCH,
  proxy as DELETE,
  proxy as OPTIONS,
};
