import type { PublicFormPayload } from '@/lib/types';
import PublicFormClient from './PublicFormClient';

export const revalidate = 60;

function normalizeOrigin(raw?: string | null): string {
  const nodeEnv = process.env.NODE_ENV;
  const isProd = nodeEnv === 'production';

  if (!raw || !raw.trim()) {
    if (!isProd) return 'http://localhost:8080';
    throw new Error('[api] Missing NEXT_PUBLIC_API_URL (or NEXT_PUBLIC_BACKEND_URL) in production.');
  }

  let base = raw.trim().replace(/\/+$/, '');
  if (base.endsWith('/api/v1')) base = base.slice(0, -'/api/v1'.length);
  return base;
}

async function fetchPublicForm(slug: string): Promise<PublicFormPayload | null> {
  try {
    const apiOrigin = normalizeOrigin(
      process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL
    );
    const url = `${apiOrigin}/api/v1/forms/${encodeURIComponent(slug)}`;

    const res = await fetch(url, {
      method: 'GET',
      next: { revalidate },
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

export default async function PublicFormPage({
  params,
}: {
  params: { slug?: string };
}) {
  const slug = params?.slug ?? '';
  const payload = slug ? await fetchPublicForm(slug) : null;

  return <PublicFormClient slug={slug} initialPayload={payload} />;
}
