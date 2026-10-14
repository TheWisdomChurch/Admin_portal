'use client';

import { Suspense, use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import { apiClient } from '@/lib/api';
import type { PublicFormPayload } from '@/lib/types';
import { PersonalizedFlyerGenerator } from '@/components/forms/PersonalizedFlyerGenerator';

interface PageProps {
  params: Promise<{ slug: string }>;
}

function FormPersonalizedFlyerContent({ slug }: { slug: string }) {
  const searchParams = useSearchParams();
  const initialName = searchParams?.get('name') || '';

  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<PublicFormPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchForm = async () => {
      try {
        setLoading(true);
        const data = await apiClient.getPublicForm(slug);
        if (mounted) {
          setFormData(data);
        }
      } catch {
        if (mounted) {
          setError('Could not load program details for this flyer.');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    if (slug) {
      fetchForm();
    }
    return () => {
      mounted = false;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-background-primary)] p-6">
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-6 py-4 shadow-xl">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--color-accent-primary)]" />
          <span className="text-sm font-semibold text-[var(--color-text-primary)]">Loading Program E-Flyer...</span>
        </div>
      </div>
    );
  }

  if (error || !formData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-background-primary)] p-6">
        <div className="w-full max-w-md rounded-3xl border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] p-8 text-center shadow-xl">
          <p className="text-base font-bold text-[var(--color-text-primary)]">{error || 'Program not found'}</p>
          <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">Please check the link and try again.</p>
          <div className="mt-6">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--lp-ink)] px-5 py-2.5 text-xs font-bold text-white shadow-md"
            >
              <ArrowLeft className="h-4 w-4" /> Return Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const form = formData.form;
  const event = formData.event;
  const flyerUrl =
    form.settings?.attendingBadge?.customFlyerUrl ||
    form.settings?.design?.coverImageUrl ||
    event?.bannerImage ||
    event?.image ||
    '';

  return (
    <div className="min-h-screen bg-[var(--color-background-secondary)] py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href={`/forms/${slug}`}
            className="inline-flex items-center gap-2 text-xs font-bold text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Registration
          </Link>
          <span className="flex items-center gap-1.5 text-xs font-bold text-[var(--lp-gold)]">
            <Sparkles className="h-4 w-4" /> Official Wisdom Church Event
          </span>
        </div>

        <PersonalizedFlyerGenerator
          flyerUrl={flyerUrl || undefined}
          eventName={event?.title || form.title}
          eventDate={event?.date}
          initialAttendeeName={initialName || undefined}
          badgeSettings={form.settings?.attendingBadge}
          shareUrl={typeof window !== 'undefined' ? window.location.href : undefined}
        />
      </div>
    </div>
  );
}

export default function FormPersonalizedFlyerPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const slug = resolvedParams.slug;

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--color-background-primary)] p-6">
          <div className="flex items-center gap-3 rounded-2xl border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-6 py-4 shadow-xl">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--color-accent-primary)]" />
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">Loading Studio...</span>
          </div>
        </div>
      }
    >
      <FormPersonalizedFlyerContent slug={slug} />
    </Suspense>
  );
}
