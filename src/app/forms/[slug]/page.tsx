import PublicFormClient from './PublicFormClient';

export default async function PublicFormPage({
  params,
}: {
  params: Promise<{ slug?: string }> | { slug?: string };
}) {
  const resolvedParams = await Promise.resolve(params);
  const slug = resolvedParams?.slug ?? '';
  return <PublicFormClient slug={slug} />;
}
