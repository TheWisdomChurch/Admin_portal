import { permanentRedirect } from 'next/navigation';

const PUBLIC_SITE_ORIGIN = (
  process.env.NEXT_PUBLIC_PUBLIC_URL ||
  process.env.NEXT_PUBLIC_FRONTEND_URL ||
  'https://wisdomchurchhq.org'
).replace(/\/+$/, '');

export default async function PublicFormPage({
  params,
}: {
  params: Promise<{ slug?: string }> | { slug?: string };
}) {
  const resolvedParams = await Promise.resolve(params);
  const slug = resolvedParams?.slug ?? '';
  permanentRedirect(`${PUBLIC_SITE_ORIGIN}/forms/${encodeURIComponent(slug)}`);
}
