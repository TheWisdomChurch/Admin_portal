import { unstable_cache } from 'next/cache';
import type { PublicFormPayload } from '@/lib/types';
import PublicFormClient from './PublicFormClient';

export const revalidate = 300;

function normalizeOrigin(raw?: string | null): string {
  let base = (raw || '').trim().replace(/\/+$/, '');
  if (base.endsWith('/api/v1')) base = base.slice(0, -'/api/v1'.length);
  return base;
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

async function fetchPublicFormFromApi(slug: string): Promise<PublicFormPayload | null> {
  try {
    const envOrigin = resolveEnvOrigin();

    if (!envOrigin) return null;

    const url = `${envOrigin}/api/v1/forms/${encodeURIComponent(slug)}`;
    const res = await fetch(url, {
      method: 'GET',
      next: { revalidate },
      cache: 'force-cache',
    });

    if (!res.ok) return null;

    const json = (await res.json()) as { data?: PublicFormPayload } | PublicFormPayload;
    const payload = 'data' in json ? json.data ?? null : (json as PublicFormPayload);

    if (!payload || !payload.form) return null;
    return payload;
  } catch (err) {
    console.error('[public-form] fetch failed', err);
    return null;
  }
}

const getPublicFormCached = (slug: string) =>
  unstable_cache(() => fetchPublicFormFromApi(slug), ['public-form', slug], { revalidate })();

export default async function PublicFormPage({
  params,
}: {
  params: { slug?: string };
}) {
  const slug = params?.slug ?? '';
  const payload = slug ? await getPublicFormCached(slug) : null;
  const fallbackApiOrigin = resolveEnvOrigin();

  return <PublicFormClient slug={slug} initialPayload={payload} fallbackApiOrigin={fallbackApiOrigin} />;
}
