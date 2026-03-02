import PublicFormClient from '@/app/forms/[slug]/PublicFormClient';

export default async function PublicFormAliasPage({
  params,
}: {
  params: Promise<{ slug?: string }> | { slug?: string };
}) {
  const resolvedParams = await Promise.resolve(params);
  const slug = resolvedParams?.slug ?? '';
  return <PublicFormClient slug={slug} />;
}
