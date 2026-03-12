import { redirect } from 'next/navigation';
import { buildPublicFormPath } from '@/lib/utils';

export default async function PublicFormAliasPage({
  params,
}: {
  params: Promise<{ slug?: string }> | { slug?: string };
}) {
  const resolvedParams = await Promise.resolve(params);
  const slug = resolvedParams?.slug ?? '';
  redirect(buildPublicFormPath(slug));
}
