import { redirect } from 'next/navigation';
import { buildPublicFormPath } from '@/lib/utils';

// Intentionally kept as a permanent redirect: this short URL may already be
// printed/emailed to church members, so it must keep resolving indefinitely.
export default async function PublicFormAliasPage({
  params,
}: {
  params: Promise<{ slug?: string }> | { slug?: string };
}) {
  const resolvedParams = await Promise.resolve(params);
  const slug = resolvedParams?.slug ?? '';
  redirect(buildPublicFormPath(slug));
}
