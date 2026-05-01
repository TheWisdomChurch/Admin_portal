import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

type ApiV1RouteContext = {
  params: Promise<{
    path: string[];
  }>;
};

const HOP_BY_HOP_REQUEST_HEADERS = new Set([
  'host',
  'connection',
  'content-length',
  'transfer-encoding',
  'upgrade',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'keep-alive',
]);

const HOP_BY_HOP_RESPONSE_HEADERS = new Set([
  'connection',
  'content-length',
  'transfer-encoding',
  'upgrade',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'keep-alive',

  /*
   * Node fetch may transparently decode compressed upstream responses.
   * Removing this prevents browsers from trying to decode already-decoded data.
   */
  'content-encoding',
]);

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '');
}

function getBackendBaseUrl(): string {
  const raw =
    process.env.API_INTERNAL_URL ||
    process.env.INTERNAL_API_URL ||
    process.env.SERVER_API_BASE_URL ||
    process.env.BACKEND_API_URL ||
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:8080';

  const value = trimTrailingSlashes(raw.trim());

  if (!value) {
    throw new Error('Backend API base URL is empty.');
  }

  if (value.startsWith('/')) {
    throw new Error(
      `Backend API base URL must be absolute on the server. Received "${value}". Use something like API_INTERNAL_URL=http://wisdom_api:8080`
    );
  }

  return value;
}

function buildTargetUrl(request: NextRequest, pathSegments: string[]): string {
  const backendBaseUrl = getBackendBaseUrl();
  const backendAlreadyIncludesApiV1 = /\/api\/v1$/i.test(backendBaseUrl);

  const encodedPath = pathSegments.map((segment) => encodeURIComponent(segment)).join('/');
  const apiPrefix = backendAlreadyIncludesApiV1 ? '' : '/api/v1';

  const target = new URL(`${backendBaseUrl}${apiPrefix}/${encodedPath}`);
  target.search = request.nextUrl.search;

  return target.toString();
}

function buildForwardHeaders(request: NextRequest): Headers {
  const headers = new Headers();

  request.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();

    if (HOP_BY_HOP_REQUEST_HEADERS.has(lowerKey)) {
      return;
    }

    headers.set(key, value);
  });

  const host = request.headers.get('host');
  const forwardedFor = request.headers.get('x-forwarded-for');

  if (host) {
    headers.set('x-forwarded-host', host);
  }

  headers.set('x-forwarded-proto', request.nextUrl.protocol.replace(':', ''));

  if (forwardedFor) {
    headers.set('x-forwarded-for', forwardedFor);
  }

  return headers;
}

function buildResponseHeaders(upstreamHeaders: Headers): Headers {
  const headers = new Headers();

  upstreamHeaders.forEach((value, key) => {
    const lowerKey = key.toLowerCase();

    if (HOP_BY_HOP_RESPONSE_HEADERS.has(lowerKey)) {
      return;
    }

    headers.set(key, value);
  });

  headers.set('cache-control', 'no-store');

  return headers;
}

function jsonError(message: string, status = 500): Response {
  return Response.json(
    {
      success: false,
      error: message,
    },
    {
      status,
      headers: {
        'cache-control': 'no-store',
      },
    }
  );
}

async function getRequestBody(request: NextRequest): Promise<ArrayBuffer | undefined> {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return undefined;
  }

  const body = await request.arrayBuffer();
  return body.byteLength > 0 ? body : undefined;
}

async function proxyApiV1Request(
  request: NextRequest,
  context: ApiV1RouteContext
): Promise<Response> {
  try {
    const { path } = await context.params;
    const targetUrl = buildTargetUrl(request, path || []);

    const upstreamResponse = await fetch(targetUrl, {
      method: request.method,
      headers: buildForwardHeaders(request),
      body: await getRequestBody(request),
      redirect: 'manual',
      cache: 'no-store',
    });

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: buildResponseHeaders(upstreamResponse.headers),
    });
  } catch (error) {
    console.error('[api/v1 proxy] request failed:', error);

    const message =
      error instanceof Error
        ? error.message
        : 'Failed to proxy request to backend API.';

    return jsonError(message, 502);
  }
}

export async function GET(
  request: NextRequest,
  context: ApiV1RouteContext
): Promise<Response> {
  return proxyApiV1Request(request, context);
}

export async function POST(
  request: NextRequest,
  context: ApiV1RouteContext
): Promise<Response> {
  return proxyApiV1Request(request, context);
}

export async function PUT(
  request: NextRequest,
  context: ApiV1RouteContext
): Promise<Response> {
  return proxyApiV1Request(request, context);
}

export async function PATCH(
  request: NextRequest,
  context: ApiV1RouteContext
): Promise<Response> {
  return proxyApiV1Request(request, context);
}

export async function DELETE(
  request: NextRequest,
  context: ApiV1RouteContext
): Promise<Response> {
  return proxyApiV1Request(request, context);
}

export async function HEAD(
  request: NextRequest,
  context: ApiV1RouteContext
): Promise<Response> {
  return proxyApiV1Request(request, context);
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      allow: 'GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS',
      'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS',
      'access-control-allow-headers':
        'Origin, Content-Type, Authorization, Accept, X-Requested-With, X-CSRF-Token',
      'access-control-allow-credentials': 'true',
      'cache-control': 'no-store',
    },
  });
}
