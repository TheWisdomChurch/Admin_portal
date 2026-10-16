import { redirect } from 'next/navigation';

export default async function FormDpAliasPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug?: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedParams = await Promise.resolve(params);
  const resolvedSearch = searchParams ? await Promise.resolve(searchParams) : {};
  const slug = resolvedParams?.slug ?? '';

  const query = new URLSearchParams();
  if (resolvedSearch) {
    Object.entries(resolvedSearch).forEach(([key, val]) => {
      if (typeof val === 'string') {
        query.set(key, val);
      } else if (Array.isArray(val)) {
        val.forEach((v) => query.append(key, v));
      }
    });
  }
  const queryString = query.toString();
  redirect(`/forms/${encodeURIComponent(slug)}/dp${queryString ? `?${queryString}` : ''}`);
}

