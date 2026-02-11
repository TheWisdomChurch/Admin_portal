import { headers } from 'next/headers';
import type { PublicFormPayload } from '@/lib/types';
import PublicFormClient from './PublicFormClient';

export const revalidate = 60;

function normalizeOrigin(raw?: string | null): string {
  let base = (raw || '').trim().replace(/\/+$/, '');
  if (base.endsWith('/api/v1')) base = base.slice(0, -'/api/v1'.length);
  return base;
}

async function getRequestOrigin(): Promise<string | null> {
  const hdrs = await headers();
  const host = hdrs.get('x-forwarded-host') ?? hdrs.get('host');
  if (!host) return null;
  const proto = hdrs.get('x-forwarded-proto') ?? 'https';
  return `${proto}://${host}`;
}

function resolveEnvOrigin(): string | null {
  const raw =
    process.env.API_PROXY_ORIGIN ??
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.NEXT_PUBLIC_BACKEND_URL ??
    process.env.APP_PUBLIC_URL ??
    (process.env.API_DOMAIN ? `https://${process.env.API_DOMAIN}` : undefined);

  if (!raw || !raw.trim()) {
    if (process.env.NODE_ENV !== 'production') return 'http://localhost:8080';
    return null;
  }

  const normalized = normalizeOrigin(raw);
  return normalized ? normalized : null;
}

async function fetchPublicForm(slug: string): Promise<PublicFormPayload | null> {
  try {
    const useProxy = process.env.NEXT_PUBLIC_API_PROXY === 'true';
    const requestOrigin = await getRequestOrigin();
    const envOrigin = resolveEnvOrigin();

    const origins: string[] = [];
    if (useProxy && requestOrigin) origins.push(requestOrigin);
    if (envOrigin && !origins.includes(envOrigin)) origins.push(envOrigin);

    for (const origin of origins) {
      const url = `${origin}/api/v1/forms/${encodeURIComponent(slug)}`;
      const res = await fetch(url, {
        method: 'GET',
        next: { revalidate },
      });

      if (!res.ok) continue;

      const json = (await res.json()) as { data?: PublicFormPayload } | PublicFormPayload;
      const payload = 'data' in json ? json.data ?? null : (json as PublicFormPayload);

      if (!payload || !payload.form) continue;
      return payload;
    }

    return null;
  } catch (err) {
    console.error('[public-form] fetch failed', err);
    return null;
  }
}

export default async function PublicFormPage({
  params,
}: {
  params: { slug?: string };
}) {
  const slug = params?.slug ?? '';
  const payload = slug ? await fetchPublicForm(slug) : null;

  return <PublicFormClient slug={slug} initialPayload={payload} />;
}
