'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Input } from '@/ui/input';
import { PageHeader } from '@/layouts';
import { apiClient } from '@/lib/api';
import { buildPublicFormUrl } from '@/lib/utils';
import type { AdminForm, FormField, FormFieldType, UpdateFormRequest } from '@/lib/types';
import { withAuth } from '@/providers/withAuth';
import toast from 'react-hot-toast';
import { Plus, Trash2, Copy, Save, Globe } from 'lucide-react';
import { extractServerFieldErrors, getFirstServerFieldError, getServerErrorMessage } from '@/lib/serverValidation';

type FieldDraft = Omit<FormField, 'id'>;

function EditFormPage() {
  const params = useParams();
  const router = useRouter();
  const formId = useMemo(() => {
    const raw = params?.id;
    return typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : '';
  }, [params]);

  const [form, setForm] = useState<AdminForm | null>(null);
  const [fields, setFields] = useState<FieldDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const clearFieldError = (key: string) =>
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });

  useEffect(() => {
    if (!formId) return;
    (async () => {
      try {
        const res = await apiClient.getAdminForm(formId);
        setForm(res);
        setFields(res.fields || []);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load form';
        toast.error(message);
        router.back();
      } finally {
        setLoading(false);
      }
    })();
  }, [formId, router]);

  const updateField = (index: number, updates: Partial<FieldDraft>) => {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, ...updates } : f)));
  };

  const addField = () => {
    const order = fields.length + 1;
    setFields((prev) => [
      ...prev,
      { key: `field_${order}`, label: 'New field', type: 'text', required: false, order },
    ]);
  };

  const removeField = (index: number) => {
    setFields((prev) => prev.filter((_, i) => i !== index));
  };

  const saveForm = async () => {
    if (!form) return;
    setFieldErrors({});
    setSaving(true);
    const payload: UpdateFormRequest = {
      title: form.title.trim(),
      description: form.description?.trim() || undefined,
      slug: form.slug,
      fields: fields.map((f, idx) => ({
        ...f,
        key: (f.key || `field_${idx + 1}`).trim(),
        label: f.label.trim(),
        order: idx + 1,
      })),
      settings: form.settings,
    };
    try {
      const updated = await apiClient.updateAdminForm(form.id, payload);
      setForm(updated);
      setFields(updated.fields || []);
      toast.success('Form updated');
      router.push('/dashboard/forms');
    } catch (err) {
      const fieldErrors = extractServerFieldErrors(err);
      if (Object.keys(fieldErrors).length > 0) {
        setFieldErrors(fieldErrors);
        toast.error(getFirstServerFieldError(fieldErrors) || 'Please review the highlighted fields.');
        return;
      }
      const message = getServerErrorMessage(err, 'Failed to save form');
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const publishForm = async () => {
    if (!form) return;
    setPublishing(true);
    try {
      const res = await apiClient.publishAdminForm(form.id);
      const slug = res?.slug || form.slug;
      setForm((prev) => (prev ? { ...prev, slug } : prev));
      toast.success('Form published');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to publish form';
      toast.error(message);
    } finally {
      setPublishing(false);
    }
  };

  const copyLink = async () => {
    const slug = form?.slug;
    if (!slug) {
      toast.error('Publish the form to get a link');
      return;
    }
    const url = buildPublicFormUrl(slug, form?.publicUrl) ?? `/forms/${encodeURIComponent(slug)}`;
    await navigator.clipboard.writeText(url);
    toast.success('Link copied');
  };

  if (loading) {
    return (
      <div className="flex min-h-[300px] w-full items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-solid border-primary-600 border-r-transparent" />
      </div>
    );
  }

  if (!form) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Edit Form"
          subtitle="Adjust fields, then save and publish."
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={copyLink} icon={<Copy className="h-4 w-4" />}>
            Copy Link
          </Button>
          <Button variant="outline" onClick={publishForm} loading={publishing} icon={<Globe className="h-4 w-4" />}>
            {form.slug ? 'Update Publish' : 'Publish'}
          </Button>
          <Button onClick={saveForm} loading={saving} icon={<Save className="h-4 w-4" />}>
            Save
          </Button>
        </div>
      </div>

      <Card>
        <div className="space-y-4">
          <Input
            label="Title"
            value={form.title}
            onChange={(e) => {
              clearFieldError('title');
              setForm({ ...form, title: e.target.value });
            }}
            error={fieldErrors.title}
          />
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Description</label>
          <textarea
            className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] focus:ring-offset-2"
            rows={3}
            value={form.description || ''}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Optional description for this form"
          />
          <Input
            label="Header image URL (optional)"
            value={form.settings?.design?.coverImageUrl || ''}
            onChange={(e) => {
              const nextValue = e.target.value;
              setForm({
                ...form,
                settings: {
                  ...form.settings,
                  design: {
                    ...form.settings?.design,
                    coverImageUrl: nextValue || undefined,
                  },
                },
              });
            }}
            helperText="Shown at the top of the public form."
          />
          <Input
            label="Success modal title (optional)"
            value={form.settings?.successTitle || ''}
            onChange={(e) => {
              const nextValue = e.target.value;
              setForm({
                ...form,
                settings: {
                  ...form.settings,
                  successTitle: nextValue || undefined,
                },
              });
            }}
            placeholder="Thank you for registering"
          />
          <Input
            label="Success modal subtitle (optional)"
            value={form.settings?.successSubtitle || ''}
            onChange={(e) => {
              const nextValue = e.target.value;
              setForm({
                ...form,
                settings: {
                  ...form.settings,
                  successSubtitle: nextValue || undefined,
                },
              });
            }}
            placeholder="for {{formTitle}}"
          />
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[var(--color-text-secondary)]">Success modal message</label>
            <textarea
              className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] focus:ring-offset-2"
              rows={2}
              value={form.settings?.successMessage || ''}
              onChange={(e) => {
                const nextValue = e.target.value;
                setForm({
                  ...form,
                  settings: {
                    ...form.settings,
                    successMessage: nextValue || undefined,
                  },
                });
              }}
              placeholder="We would love to see you."
            />
          </div>
        </div>
      </Card>

      <Card title="Fields">
        <div className="space-y-4">
          {fields.map((field, index) => (
            <div
              key={index}
              className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
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
                    <option value="radio">Radio</option>
                    <option value="image">Image Upload</option>
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

              {(field.type === 'select' || field.type === 'radio' || field.type === 'checkbox') && (
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
                          .map((opt, idx) => ({ label: opt, value: opt.toLowerCase().replace(/\s+/g, '-') + idx })),
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

      <Card title="Preview Link">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-[var(--color-text-secondary)]">
            {form.slug ? `/forms/${form.slug}` : 'Publish to generate link'}
          </p>
          <Button variant="outline" size="sm" onClick={copyLink} icon={<Copy className="h-4 w-4" />}>
            Copy
          </Button>
        </div>
      </Card>
    </div>
  );
}

export default withAuth(EditFormPage, { requiredRole: 'admin' });
