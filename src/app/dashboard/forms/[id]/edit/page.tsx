'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Input } from '@/ui/input';
import { PageHeader } from '@/layouts';
import { apiClient } from '@/lib/api';
import { buildPublicFormUrl } from '@/lib/utils';
import type { AdminForm, EventData, FormField, FormFieldType, FormSettings, UpdateFormRequest } from '@/lib/types';
import { withAuth } from '@/providers/withAuth';
import toast from 'react-hot-toast';
import { Plus, Trash2, Copy, Save, Globe } from 'lucide-react';
import { extractServerFieldErrors, getFirstServerFieldError, getServerErrorMessage } from '@/lib/serverValidation';
import { AlertModal } from '@/ui/AlertModal';

type FieldDraft = Omit<FormField, 'id'>;

const MAX_BANNER_MB = 5;
const MAX_BANNER_BYTES = MAX_BANNER_MB * 1024 * 1024;
const ACCEPTED_BANNER_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

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
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [removeFieldIndex, setRemoveFieldIndex] = useState<number | null>(null);
  const [events, setEvents] = useState<EventData[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  const clearFieldError = (key: string) =>
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });

  const validateBannerFile = (file: File): string | null => {
    if (!ACCEPTED_BANNER_TYPES.includes(file.type)) {
      return 'Banner must be JPEG, PNG, or WebP.';
    }
    if (file.size > MAX_BANNER_BYTES) {
      return `Banner must be ${MAX_BANNER_MB}MB or smaller.`;
    }
    return null;
  };

  useEffect(() => {
    return () => {
      if (bannerPreview) URL.revokeObjectURL(bannerPreview);
    };
  }, [bannerPreview]);

  const handleBannerFile = (file?: File) => {
    if (!file) {
      setBannerFile(null);
      setBannerPreview(null);
      return;
    }
    const error = validateBannerFile(file);
    if (error) {
      toast.error(error);
      setBannerFile(null);
      setBannerPreview(null);
      return;
    }
    setBannerFile(file);
    setBannerPreview(URL.createObjectURL(file));
  };

  const updateSettings = (updates: Partial<FormSettings>) => {
    setForm((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        settings: {
          ...prev.settings,
          ...updates,
        },
      };
    });
  };

  const toLocalInput = (value?: string): string => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
      date.getMinutes()
    )}`;
  };

  const fromLocalInput = (value: string): string | undefined => {
    if (!value) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return undefined;
    return date.toISOString();
  };

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

  useEffect(() => {
    (async () => {
      try {
        setEventsLoading(true);
        const res = await apiClient.getEvents({ page: 1, limit: 200 });
        setEvents(Array.isArray(res.data) ? res.data : []);
      } catch {
        setEvents([]);
      } finally {
        setEventsLoading(false);
      }
    })();
  }, []);

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

  const requestRemoveField = (index: number) => {
    setRemoveFieldIndex(index);
  };

  const confirmRemoveField = () => {
    if (removeFieldIndex === null) return;
    setFields((prev) => prev.filter((_, i) => i !== removeFieldIndex));
    setRemoveFieldIndex(null);
  };

  const uploadBanner = async () => {
    if (!form || !bannerFile) return;
    try {
      setBannerUploading(true);
      const updated = await apiClient.uploadFormBanner(form.id, bannerFile);
      setForm(updated);
      setBannerFile(null);
      setBannerPreview(null);
      toast.success('Banner uploaded');
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Banner upload failed';
      toast.error(message);
    } finally {
      setBannerUploading(false);
    }
  };

  const saveForm = async () => {
    if (!form) return;
    setFieldErrors({});
    setSaving(true);
    const payload: UpdateFormRequest = {
      title: form.title.trim(),
      description: form.description?.trim() || undefined,
      slug: form.slug,
      eventId: form.eventId,
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

  const pendingField = removeFieldIndex !== null ? fields[removeFieldIndex] : null;

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
    if (!slug && !form?.publicUrl) {
      toast.error('Publish the form to get a link');
      return;
    }
    const url = buildPublicFormUrl(slug, form?.publicUrl) ?? (slug ? `/forms/${encodeURIComponent(slug)}` : '');
    if (!url) {
      toast.error('Form link unavailable');
      return;
    }
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

  const responseEmailEnabled = form.settings?.responseEmailEnabled ?? true;
  const submissionTarget = form.settings?.submissionTarget ?? '';

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
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="Or upload header image"
              type="file"
              accept="image/*"
              onChange={(e) => handleBannerFile(e.target.files?.[0])}
              helperText="Uploads to S3 and replaces the URL above."
            />
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={uploadBanner}
                loading={bannerUploading}
                disabled={!bannerFile || bannerUploading}
              >
                Upload Banner
              </Button>
            </div>
          </div>
          {(bannerPreview || form.settings?.design?.coverImageUrl) && (
            <Image
              src={bannerPreview || form.settings?.design?.coverImageUrl || ''}
              alt="Banner preview"
              width={1200}
              height={400}
              className="w-full max-h-64 rounded-[var(--radius-card)] object-cover border border-[var(--color-border-secondary)]"
              unoptimized
            />
          )}
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

      <Card title="Registration Settings">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Linked Event</label>
            <select
              className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
              value={form.eventId || ''}
              onChange={(e) => setForm({ ...form, eventId: e.target.value || undefined })}
              disabled={eventsLoading}
            >
              <option value="">No event (standalone form)</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Capacity (optional)"
            type="number"
            min={0}
            value={form.settings?.capacity ?? ''}
            onChange={(e) => updateSettings({ capacity: e.target.value ? Number(e.target.value) : undefined })}
          />

          <Input
            label="Closes At (optional)"
            type="datetime-local"
            value={toLocalInput(form.settings?.closesAt)}
            onChange={(e) => updateSettings({ closesAt: fromLocalInput(e.target.value) })}
          />

          <Input
            label="Expires At (optional)"
            type="datetime-local"
            value={toLocalInput(form.settings?.expiresAt)}
            onChange={(e) => updateSettings({ expiresAt: fromLocalInput(e.target.value) })}
          />

          <Input
            label="Success Message (optional)"
            value={form.settings?.successMessage ?? ''}
            onChange={(e) => updateSettings({ successMessage: e.target.value })}
          />
        </div>
      </Card>

      <Card title="Submission Routing">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Submission Target</label>
            <select
              className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
              value={submissionTarget}
              onChange={(e) => updateSettings({ submissionTarget: e.target.value ? (e.target.value as FormSettings['submissionTarget']) : undefined })}
            >
              <option value="">Do not route</option>
              <option value="workforce">Workforce</option>
              <option value="member">Member</option>
            </select>
            {fieldErrors.submissionTarget && (
              <p className="text-sm text-red-500">{fieldErrors.submissionTarget}</p>
            )}
          </div>
          <Input
            label="Department (workforce only)"
            value={form.settings?.submissionDepartment ?? ''}
            onChange={(e) => updateSettings({ submissionDepartment: e.target.value })}
            placeholder="e.g., Hospitality"
            disabled={submissionTarget !== 'workforce'}
            error={fieldErrors.submissionDepartment}
          />
        </div>
      </Card>

      <Card title="Response Email">
        <div className="space-y-4">
          <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
            <input
              type="checkbox"
              checked={responseEmailEnabled}
              onChange={(e) => updateSettings({ responseEmailEnabled: e.target.checked })}
            />
            Enable response email
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Email subject"
              value={form.settings?.responseEmailSubject ?? ''}
              onChange={(e) => updateSettings({ responseEmailSubject: e.target.value })}
              disabled={!responseEmailEnabled}
              error={fieldErrors.responseEmailSubject}
            />
            <Input
              label="Template key"
              value={form.settings?.responseEmailTemplateKey ?? ''}
              onChange={(e) => updateSettings({ responseEmailTemplateKey: e.target.value })}
              disabled={!responseEmailEnabled}
              error={fieldErrors.responseEmailTemplateKey}
            />
            <Input
              label="Template ID (optional)"
              value={form.settings?.responseEmailTemplateId ?? ''}
              onChange={(e) => updateSettings({ responseEmailTemplateId: e.target.value })}
              disabled={!responseEmailEnabled}
              error={fieldErrors.responseEmailTemplateId}
            />
          </div>
          <p className="text-xs text-[var(--color-text-tertiary)]">
            Template key or ID must match a template saved in the Email Templates registry. Leave blank to use the
            default confirmation email.
          </p>
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
                  <Button variant="outline" size="sm" onClick={() => requestRemoveField(index)} icon={<Trash2 className="h-4 w-4" />}>
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
            {form.publicUrl || (form.slug ? `/forms/${form.slug}` : 'Publish to generate link')}
          </p>
          <Button variant="outline" size="sm" onClick={copyLink} icon={<Copy className="h-4 w-4" />}>
            Copy
          </Button>
        </div>
      </Card>

      <AlertModal
        open={removeFieldIndex !== null}
        onClose={() => setRemoveFieldIndex(null)}
        title="Remove Field"
        description={`Remove "${pendingField?.label || 'this field'}"? This will delete it from the form.`}
        primaryAction={{ label: 'Remove', onClick: confirmRemoveField, variant: 'danger' }}
        secondaryAction={{ label: 'Cancel', onClick: () => setRemoveFieldIndex(null), variant: 'outline' }}
      />
    </div>
  );
}

export default withAuth(EditFormPage, { requiredRole: 'admin' });
