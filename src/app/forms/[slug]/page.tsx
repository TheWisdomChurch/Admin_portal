import PublicFormClient from './PublicFormClient';

export default function PublicFormPage({ params }: { params: { slug?: string } }) {
  const slug = params?.slug ?? '';
  return <PublicFormClient slug={slug} />;
}
