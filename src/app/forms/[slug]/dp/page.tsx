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
  const rawFirstName = searchParams?.get('firstName') || searchParams?.get('first_name') || '';
  const rawFullName = searchParams?.get('fullName') || searchParams?.get('full_name') || '';
  const rawName = searchParams?.get('name') || '';

  // Prioritize first name, or extract first word from full name
  const initialName =
    rawFirstName ||
    (rawName && !rawName.includes(' ') ? rawName : '') ||
    (rawFullName ? rawFullName.trim().split(/\s+/)[0] : '') ||
    (rawName ? rawName.trim().split(/\s+/)[0] : '');

  const effectiveFullName = rawFullName || (rawName && rawName.includes(' ') ? rawName : '');

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
        try {
          const adminForm = await apiClient.getAdminForm(slug);
          if (mounted && adminForm) {
            setFormData({ form: adminForm });
            return;
          }
        } catch {
          // Both failed
        }
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
      <div className="flex min-h-screen items-center justify-center bg-(--color-background-primary) p-6">
        <div className="flex items-center gap-3 rounded-2xl border border-(--color-border-primary) bg-(--color-background-secondary) px-6 py-4 shadow-xl">
          <Loader2 className="h-5 w-5 animate-spin text-(--color-accent-primary)" />
          <span className="text-sm font-semibold text-(--color-text-primary)">Loading Program E-Flyer...</span>
        </div>
      </div>
    );
  }

  if (error || !formData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-(--color-background-primary) p-6">
        <div className="w-full max-w-md rounded-3xl border border-(--color-border-primary) bg-(--color-background-secondary) p-8 text-center shadow-xl">
          <p className="text-base font-bold text-(--color-text-primary)">{error || 'Program not found'}</p>
          <p className="mt-2 text-xs text-(--color-text-tertiary)">Please check the link and try again.</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl bg-(--lp-ink) px-5 py-2.5 text-xs font-bold text-white shadow-md hover:opacity-95"
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
    <div className="min-h-screen bg-(--color-background-secondary) py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href={`/forms/${slug}`}
            className="inline-flex items-center gap-2 text-xs font-bold text-(--color-text-tertiary) hover:text-(--color-text-primary)"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Registration
          </Link>
          <span className="flex items-center gap-1.5 text-xs font-bold text-(--lp-gold)">
            <Sparkles className="h-4 w-4" /> Official Wisdom Church Event
          </span>
        </div>

        <PersonalizedFlyerGenerator
          flyerUrl={flyerUrl || undefined}
          eventName={event?.title || form.title}
          eventDate={event?.date}
          initialAttendeeName={initialName || undefined}
          initialFullName={effectiveFullName || undefined}
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
        <div className="flex min-h-screen items-center justify-center bg-(--color-background-primary) p-6">
          <div className="flex items-center gap-3 rounded-2xl border border-(--color-border-primary) bg-(--color-background-secondary) px-6 py-4 shadow-xl">
            <Loader2 className="h-5 w-5 animate-spin text-(--color-accent-primary)" />
            <span className="text-sm font-semibold text-(--color-text-primary)">Loading Studio...</span>
          </div>
        </div>
      }
    >
      <FormPersonalizedFlyerContent slug={slug} />
    </Suspense>
  );
}
