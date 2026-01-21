// src/app/(dashboard)/dashboard/forms/new/page.tsx
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { ArrowLeft, Save } from 'lucide-react';

import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { PageHeader } from '@/layouts';
import { Input } from '@/ui/input';

import { apiClient } from '@/lib/api';
import type { CreateFormRequest, FormFieldType } from '@/lib/types';

import { withAuth } from '@/providers/withAuth';
import { useAuthContext } from '@/providers/AuthProviders';

type FieldDraft = {
  key: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  order: number;
};

export default withAuth(function NewFormPage() {
  const router = useRouter();
  const auth = useAuthContext();

  const authBlocked = useMemo(
    () => !auth.isInitialized || auth.isLoading,
    [auth.isInitialized, auth.isLoading]
  );

  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [slug, setSlug] = useState('');

  // minimal v1: create a draft with at least one field
  const [fields, setFields] = useState<FieldDraft[]>([
    { key: 'full_name', label: 'Full Name', type: 'text', required: true, order: 1 },
  ]);

  const normalizeSlug = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-|-$/g, '');

  const save = async () => {
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }

    if (!slug.trim()) {
      toast.error('Form link name is required');
      return;
    }

    const normalizedSlug = normalizeSlug(slug);
    if (!normalizedSlug) {
      toast.error('Form link name must contain letters or numbers');
      return;
    }

    const payload: CreateFormRequest = {
      title: title.trim(),
      description: description.trim() || undefined,
      slug: normalizedSlug,
      fields: fields.map((f) => ({
        key: f.key.trim(),
        label: f.label.trim(),
        type: f.type,
        required: f.required,
        options: undefined,
        order: f.order,
      })),
      settings: {
        successMessage: 'Thanks! Your registration has been received.',
      },
    };

    try {
      setSaving(true);
      const created = await apiClient.createAdminForm(payload);
      toast.success('Form created');
      router.push('/dashboard/forms');
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Failed to create form');
    } finally {
      setSaving(false);
    }
  };

  if (authBlocked) {
    return (
      <div className="flex min-h-[300px] w-full items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-solid border-primary-600 border-r-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <PageHeader
          title="Create Form"
          subtitle="Create a draft registration form. You can add/edit fields on the next screen."
        />
      </div>

      <Card className="p-6">
        <div className="grid gap-5 md:grid-cols-2">
          <Input
            label="Title *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Youth Summit Registration"
          />

          <div className="space-y-2">
            <Input
              label="Form Link Name *"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              onBlur={() => setSlug((current) => normalizeSlug(current))}
              placeholder="e.g., wpc"
            />
            <p className="text-xs text-[var(--color-text-tertiary)]">
              Public link preview:{' '}
              <span className="font-medium text-[var(--color-text-secondary)]">
                /forms/{normalizeSlug(slug || 'your-link')}
              </span>
            </p>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Description</label>
            <textarea
              className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] focus:ring-offset-2"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional short intro"
            />
          </div>

          <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3 pt-2">
            <p className="text-xs text-[var(--color-text-tertiary)]">
              Drafts stay private until you publish and share the link.
            </p>
            <Button onClick={save} loading={saving} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              Create Draft
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}, { requiredRole: 'admin' });
