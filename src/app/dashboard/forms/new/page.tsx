// src/app/(dashboard)/dashboard/forms/new/page.tsx
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { ArrowLeft, Save, Plus, Trash2, Globe, Copy } from 'lucide-react';

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
  const [publishedSlug, setPublishedSlug] = useState<string | null>(null);

  // minimal v1: create a draft with at least one field
  const [fields, setFields] = useState<FieldDraft[]>([
    { key: 'full_name', label: 'Full Name', type: 'text', required: true, order: 1 },
    { key: 'email', label: 'Email', type: 'email', required: true, order: 2 },
  ]);

  const normalizeSlug = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-|-$/g, '');

  const addField = () => {
    const order = fields.length + 1;
    setFields((prev) => [
      ...prev,
      { key: `field_${order}`, label: 'New field', type: 'text', required: false, order },
    ]);
  };

  const updateField = (index: number, updates: Partial<FieldDraft>) => {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, ...updates } : f)));
  };

  const removeField = (index: number) => {
    setFields((prev) => prev.filter((_, i) => i !== index));
  };

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
      fields: fields.map((f, idx) => ({
        key: (f.key || `field_${idx + 1}`).trim(),
        label: f.label.trim(),
        type: f.type,
        required: f.required,
        options: f.options,
        order: idx + 1,
      })),
      settings: {
        successMessage: 'Thanks! Your registration has been received.',
      },
    };

    try {
      setSaving(true);
      const created = await apiClient.createAdminForm(payload);
      let slugToUse = created.slug || normalizedSlug;
      try {
        const published = await apiClient.publishAdminForm(created.id);
        slugToUse = published?.slug || slugToUse;
      } catch {
        // publish may be optional; keep slug from creation
      }
      setPublishedSlug(slugToUse);
      toast.success('Form created and link ready');
      router.push(`/dashboard/forms/${created.id}/edit`);
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

          <div className="md:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-[var(--color-text-tertiary)]">
                Build the form fields below, then create to generate the link.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={save} loading={saving} disabled={saving} icon={<Save className="h-4 w-4" />}>
                  Create & Publish
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Form Builder">
        <div className="space-y-4">
          {fields.map((field, index) => (
            <div
              key={index}
              className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-4"
            >
              <div className="flex flex-wrap items-start gap-3">
                <Input
                  label="Label"
                  value={field.label}
                  onChange={(e) => updateField(index, { label: e.target.value })}
                />
                <div className="flex flex-wrap gap-2">
                  <select
                    value={field.type}
                    onChange={(e) => updateField(index, { type: e.target.value as FormFieldType })}
                    className="rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm"
                  >
                    <option value="text">Text</option>
                    <option value="textarea">Textarea</option>
                    <option value="email">Email</option>
                    <option value="tel">Phone</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                    <option value="select">Dropdown</option>
                    <option value="checkbox">Checkbox</option>
                  </select>
                  <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(e) => updateField(index, { required: e.target.checked })}
                    />
                    Required
                  </label>
                  <Button variant="outline" size="sm" onClick={() => removeField(index)} icon={<Trash2 className="h-4 w-4" />}>
                    Remove
                  </Button>
                </div>
              </div>
              {field.type === 'select' && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-[var(--color-text-tertiary)]">Options (comma separated)</p>
                  <input
                    className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm"
                    value={(field.options || []).map((o) => o.label).join(', ')}
                    onChange={(e) =>
                      updateField(index, {
                        options: e.target.value
                          .split(',')
                          .map((opt) => opt.trim())
                          .filter(Boolean)
                          .map((opt, idx) => ({ label: opt, value: `${opt.toLowerCase().replace(/\s+/g, '-')}-${idx}` })),
                      })
                    }
                    placeholder="Option one, Option two"
                  />
                </div>
              )}
            </div>
          ))}
          <Button variant="outline" onClick={addField} icon={<Plus className="h-4 w-4" />}>
            Add Field
          </Button>
        </div>
      </Card>

      <Card title="Form Link">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-[var(--color-text-secondary)]">
            {publishedSlug ? `/forms/${publishedSlug}` : 'Create & publish to generate link'}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              if (!publishedSlug) {
                toast.error('Publish first to copy link');
                return;
              }
              await navigator.clipboard.writeText(`${window.location.origin}/forms/${publishedSlug}`);
              toast.success('Link copied');
            }}
            icon={<Copy className="h-4 w-4" />}
            disabled={!publishedSlug}
          >
            Copy
          </Button>
        </div>
      </Card>
    </div>
  );
}, { requiredRole: 'admin' });
