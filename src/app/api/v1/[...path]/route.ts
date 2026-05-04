import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ path?: string[] }> | { path?: string[] };
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

function getBackendBaseURL(): string {
  const raw =
    process.env.API_INTERNAL_URL ||
    process.env.BACKEND_INTERNAL_URL ||
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
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

    if (HOP_BY_HOP_HEADERS.has(lower)) {
      return;
    }

    headers.set(key, value);
  });

  const host = request.headers.get('host');
  if (host) {
    headers.set('x-forwarded-host', host);
  }

  headers.set('x-forwarded-proto', request.nextUrl.protocol.replace(':', '') || 'https');

  return headers;
}

function buildResponseHeaders(upstreamHeaders: Headers): Headers {
  const headers = new Headers();

  upstreamHeaders.forEach((value, key) => {
    const lower = key.toLowerCase();

    if (
      lower === 'connection' ||
      lower === 'content-length' ||
      lower === 'transfer-encoding' ||
      lower === 'content-encoding'
    ) {
      return;
    }

    headers.set(key, value);
  });

  headers.set('cache-control', 'no-store');

  return headers;
}

async function proxy(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const params = await context.params;
  const pathParts = Array.isArray(params.path) ? params.path : [];
  const method = request.method.toUpperCase();
  const targetURL = buildTargetURL(request, pathParts);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  try {
    const body =
      method === 'GET' || method === 'HEAD'
        ? undefined
        : await request.arrayBuffer();

    const upstream = await fetch(targetURL, {
      method,
      headers: buildForwardHeaders(request),
      body,
      redirect: 'manual',
      cache: 'no-store',
      signal: controller.signal,
    });

    return new NextResponse(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: buildResponseHeaders(upstream.headers),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown proxy error';

    console.error('[admin-api-proxy] upstream request failed', {
      method,
      targetURL,
      message,
    });

    return NextResponse.json(
      {
        error: 'Bad Gateway',
        message: 'Admin could not reach the backend API.',
        detail: process.env.NODE_ENV === 'production' ? undefined : message,
      },
      { status: 502 }
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
