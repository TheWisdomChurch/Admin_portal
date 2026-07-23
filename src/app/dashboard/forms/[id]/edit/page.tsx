'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Plus, Trash2, Copy, Save, Globe, Mail, MailCheck, Send, ExternalLink } from 'lucide-react';

import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Input } from '@/ui/Input';
import { PageHeader } from '@/layouts';
import { AlertModal } from '@/ui/AlertModal';
import FormFieldOrderBuilder from '../../FormFieldOrderBuilder';
import { FieldEditor, type FieldDraft } from '../../_shared/FieldEditor';
import { apiClient } from '@/lib/api';
import { ensureFieldOptions, isOptionFieldType, normalizeFieldOptions, sanitizeFieldVisibility } from '@/lib/formFields';

import { normalizeOrderedFields } from '@/lib/formFieldOrdering';
import {
  buildFormSubmissionsReportPath,
  copyFormSubmissionsReportLink,
} from '@/lib/formSubmissions';
import { buildPublicFormUrl } from '@/lib/utils';
import {
  extractServerFieldErrors,
  getFirstServerFieldError,
  getServerErrorMessage,
} from '@/lib/serverValidation';

import type {
  AdminForm,
  EventData,
  FormContentSection,
  FormField,
  FormFieldVisibility,
  FormSettings,
  UpdateFormRequest,
} from '@/lib/types';

import { withAuth } from '@/providers/withAuth';

const MAX_BANNER_MB = 5;
const MAX_BANNER_BYTES = MAX_BANNER_MB * 1024 * 1024;
const ACCEPTED_BANNER_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const formTypeOptions: Array<{
  value: NonNullable<FormSettings['formType']>;
  label: string;
}> = [
  { value: 'registration', label: 'Registration' },
  { value: 'event', label: 'Event' },
  { value: 'membership', label: 'Membership' },
  { value: 'workforce', label: 'Workforce' },
  { value: 'leadership', label: 'Leadership' },
  { value: 'application', label: 'Application' },
  { value: 'contact', label: 'Contact' },
  { value: 'general', label: 'General' },
];

function normalizeFieldKey(value: string, fallback: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_+|_+$/g, '') || fallback
  );
}

function normalizeVisibilityToken(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function isAffirmativeOption(value: string) {
  const token = normalizeVisibilityToken(value);
  return token === 'yes' || token === 'true' || token === '1';
}

function isNegativeOption(value: string) {
  const token = normalizeVisibilityToken(value);
  return token === 'no' || token === 'false' || token === '0';
}

function looksLikeIfYesLabel(label: string) {
  return /^\s*if\s+yes\b/i.test(label);
}

function findYesOptionValue(field: Pick<FormField, 'type' | 'options'>) {
  const options = Array.isArray(field.options) ? field.options : [];

  if ((field.type !== 'radio' && field.type !== 'select') || options.length === 0) {
    return undefined;
  }

  let yesValue: string | undefined;
  let hasNoOption = false;

  options.forEach((option) => {
    const label = option.label || '';
    const value = option.value || '';

    if (!yesValue && (isAffirmativeOption(label) || isAffirmativeOption(value))) {
      yesValue = value || label;
    }

    if (isNegativeOption(label) || isNegativeOption(value)) {
      hasNoOption = true;
    }
  });

  return yesValue && hasNoOption ? yesValue : undefined;
}

function buildImplicitYesVisibility(fields: FieldDraft[], currentIndex: number): FormFieldVisibility | undefined {
  const currentField = fields[currentIndex];

  if (!currentField || !looksLikeIfYesLabel(currentField.label || '')) {
    return undefined;
  }

  for (let index = currentIndex - 1; index >= 0; index -= 1) {
    const candidate = fields[index];
    const fieldKey = candidate?.key?.trim();
    const yesValue = candidate ? findYesOptionValue(candidate) : undefined;

    if (!fieldKey || !yesValue) continue;

    return {
      match: 'all',
      rules: [
        {
          fieldKey,
          operator: 'equals',
          value: yesValue,
        },
      ],
    };
  }

  return undefined;
}

function applyImplicitYesVisibilityDefaults(fields: FieldDraft[]): FieldDraft[] {
  return fields.map((field, index) => {
    if (sanitizeFieldVisibility(field.visibility)) return field;

    const suggestedVisibility = buildImplicitYesVisibility(fields, index);
    if (!suggestedVisibility) return field;

    return {
      ...field,
      visibility: suggestedVisibility,
    };
  });
}

function splitLines(value: string): string[] | undefined {
  const items = value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);

  return items.length > 0 ? items : undefined;
}

function createEmptyContentSection(): FormContentSection {
  return {
    title: '',
    subtitle: '',
    items: [],
    itemSubtexts: [],
  };
}

function sanitizeContentSection(section?: FormContentSection): FormContentSection | null {
  const title = section?.title?.trim() || '';
  const subtitle = section?.subtitle?.trim() || '';
  const items = Array.isArray(section?.items)
    ? section.items.map((item) => item.trim()).filter(Boolean)
    : [];
  const itemSubtexts = Array.isArray(section?.itemSubtexts)
    ? section.itemSubtexts.map((item) => item.trim())
    : [];

  if (!title && !subtitle && items.length === 0 && !itemSubtexts.some(Boolean)) {
    return null;
  }

  return {
    title: title || undefined,
    subtitle: subtitle || undefined,
    items: items.length > 0 ? items : undefined,
    itemSubtexts: itemSubtexts.some(Boolean) ? itemSubtexts : undefined,
  };
}

function sanitizeContentSections(sections?: FormContentSection[]): FormContentSection[] | undefined {
  if (!Array.isArray(sections) || sections.length === 0) return undefined;

  const normalized = sections
    .map((section) => sanitizeContentSection(section))
    .filter((section): section is FormContentSection => Boolean(section));

  return normalized.length > 0 ? normalized : undefined;
}

function EditFormPage() {
  const params = useParams();
  const router = useRouter();

  const formId = useMemo(() => {
    const raw = params?.id;
    return typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : '';
  }, [params]);

  const [form, setForm] = useState<AdminForm | null>(null);
  const [fields, setFields] = useState<FieldDraft[]>([]);
  const orderedFields = useMemo(() => normalizeOrderedFields(fields), [fields]);
  const [saving, setSaving] = useState(false);
  const [savingResponseEmail, setSavingResponseEmail] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventData[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [removeFieldIndex, setRemoveFieldIndex] = useState<number | null>(null);

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

  useEffect(() => {
    if (!formId) return;

    const loadForm = async () => {
      try {
        const res = await apiClient.getAdminForm(formId);
        setForm(res);
        setFields(normalizeOrderedFields(applyImplicitYesVisibilityDefaults(res.fields || []).map(ensureFieldOptions)));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to load form');
        router.back();
      } finally {
        setLoading(false);
      }
    };

    loadForm();
  }, [formId, router]);

  useEffect(() => {
    const loadEvents = async () => {
      try {
        setEventsLoading(true);
        const res = await apiClient.getEvents({ page: 1, limit: 200 });
        setEvents(Array.isArray(res.data) ? res.data : []);
      } catch {
        setEvents([]);
      } finally {
        setEventsLoading(false);
      }
    };

    loadEvents();
  }, []);

  const updateField = (index: number, updates: Partial<FieldDraft>) => {
    setFields((prev) =>
      prev.map((field, fieldIndex) => {
        if (fieldIndex !== index) return field;

        const next = { ...field, ...updates };

        if (updates.type) {
          return ensureFieldOptions(next);
        }

        return next;
      })
    );
  };

  // Per-field option/visibility editing is owned by the shared <FieldEditor>
  // (forms/_shared/FieldEditor.tsx) — updateField below is its single entry
  // point for all field mutations.

  const toLocalInput = (value?: string) => {
    if (!value) return '';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const tzOffset = date.getTimezoneOffset() * 60_000;
    return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
  };

  const fromLocalInput = (value: string) => {
    if (!value) return undefined;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return undefined;

    return date.toISOString();
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

  const addField = () => {
    const order = fields.length + 1;

    setFields((prev) =>
      normalizeOrderedFields([
        ...prev,
        {
          key: `field_${order}`,
          label: 'New field',
          type: 'text',
          required: false,
          order,
        },
      ])
    );
  };

  const requestRemoveField = (index: number) => {
    setRemoveFieldIndex(index);
  };

  const confirmRemoveField = () => {
    if (removeFieldIndex === null) return;

    setFields((prev) =>
      normalizeOrderedFields(prev.filter((_, index) => index !== removeFieldIndex))
    );

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
      toast.error(err instanceof Error ? err.message : 'Banner upload failed');
    } finally {
      setBannerUploading(false);
    }
  };

  const saveForm = async () => {
    if (!form) return;

    setFieldErrors({});

    for (const field of fields) {
      if (!field.label?.trim()) {
        toast.error('Every field must have a label.');
        return;
      }

      if (isOptionFieldType(field.type)) {
        const options = normalizeFieldOptions(field);

        if (!options || options.length === 0) {
          toast.error(`${field.label || 'Option field'} must have at least one option.`);
          return;
        }
      }
    }

    setSaving(true);

    const sanitizedSettings = form.settings
      ? {
          ...form.settings,
          contentSections: sanitizeContentSections(form.settings.contentSections),
        }
      : undefined;

    const payload: UpdateFormRequest = {
      title: form.title.trim(),
      description: form.description?.trim() || undefined,
      slug: form.slug,
      eventId: form.eventId,
      fields: normalizeOrderedFields(fields).map((field, index) => ({
        ...field,
        key: normalizeFieldKey(field.key || `field_${index + 1}`, `field_${index + 1}`),
        label: field.label.trim(),
        required: field.required === true,
        options: normalizeFieldOptions(field),
        visibility: sanitizeFieldVisibility(field.visibility),
        order: index + 1,
      })),
      settings: sanitizedSettings,
    };

    try {
      const updated = await apiClient.updateAdminForm(form.id, payload);

      setForm(updated);
      setFields(normalizeOrderedFields(applyImplicitYesVisibilityDefaults(updated.fields || []).map(ensureFieldOptions)));

      toast.success('Form updated');
      router.push('/dashboard/forms');
    } catch (err) {
      const fieldErrors = extractServerFieldErrors(err);

      if (Object.keys(fieldErrors).length > 0) {
        setFieldErrors(fieldErrors);
        toast.error(getFirstServerFieldError(fieldErrors) || 'Please review the highlighted fields.');
        return;
      }

      toast.error(getServerErrorMessage(err, 'Failed to save form'));
    } finally {
      setSaving(false);
    }
  };

  const saveResponseEmailSettings = async () => {
    if (!form) return;

    setFieldErrors({});
    setSavingResponseEmail(true);

    const sanitizedSettings: FormSettings = {
      ...form.settings,
      responseEmailEnabled,
      contentSections: sanitizeContentSections(form.settings?.contentSections),
    };

    try {
      const updated = await apiClient.updateAdminForm(form.id, {
        settings: sanitizedSettings,
      });

      setForm(updated);
      toast.success('Response email settings saved');
    } catch (err) {
      const fieldErrors = extractServerFieldErrors(err);

      if (Object.keys(fieldErrors).length > 0) {
        setFieldErrors(fieldErrors);
        toast.error(getFirstServerFieldError(fieldErrors) || 'Please review the highlighted fields.');
        return;
      }

      toast.error(getServerErrorMessage(err, 'Failed to save response email settings'));
    } finally {
      setSavingResponseEmail(false);
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
      toast.error(err instanceof Error ? err.message : 'Failed to publish form');
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

    const url = buildPublicFormUrl(slug, form?.publicUrl);

    if (!url) {
      toast.error('Publish the form to get a link');
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const copyReportLink = async () => {
    if (!form?.id) return;

    try {
      await copyFormSubmissionsReportLink(form.id);
      toast.success('Client report link copied');
    } catch {
      toast.error('Failed to copy report link');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[300px] w-full items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-solid border-[var(--color-accent-primary)] border-r-transparent" />
      </div>
    );
  }

  if (!form) return null;

  const responseEmailEnabled = form.settings?.responseEmailEnabled ?? true;
  const formType = form.settings?.formType ?? '';
  const submissionTarget = form.settings?.submissionTarget ?? '';
  const isWorkforceTarget =
    submissionTarget === 'workforce' ||
    submissionTarget === 'workforce_new' ||
    submissionTarget === 'workforce_serving';

  const introBulletsValue = (form.settings?.introBullets ?? []).join('\n');
  const introBulletSubtextsValue = (form.settings?.introBulletSubtexts ?? []).join('\n');
  const contentSections = form.settings?.contentSections ?? [];
  const pendingField = removeFieldIndex !== null ? orderedFields[removeFieldIndex] : null;

  const addContentSection = () => {
    updateSettings({ contentSections: [...contentSections, createEmptyContentSection()] });
  };

  const updateContentSection = (index: number, updates: Partial<FormContentSection>) => {
    updateSettings({
      contentSections: contentSections.map((section, sectionIndex) =>
        sectionIndex === index ? { ...section, ...updates } : section
      ),
    });
  };

  const removeContentSection = (index: number) => {
    const nextSections = contentSections.filter((_, sectionIndex) => sectionIndex !== index);
    updateSettings({ contentSections: nextSections.length > 0 ? nextSections : undefined });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader title="Edit Form" subtitle="Adjust fields, save changes, then publish the live form." />

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/dashboard/forms/${form.id}/campaigns`)}
            icon={<Send className="h-4 w-4" />}
          >
            Ads & Outreach
          </Button>

          <Button
            variant="outline"
            onClick={() => router.push(`/dashboard/forms/${form.id}/response-email`)}
            icon={<Mail className="h-4 w-4" />}
          >
            Response Email
          </Button>

          <Button variant="outline" onClick={copyLink} icon={<Copy className="h-4 w-4" />}>
            Copy Link
          </Button>

          <Button variant="outline" onClick={() => router.push(buildFormSubmissionsReportPath(form.id))}>
            Open Report
          </Button>

          <Button variant="outline" onClick={copyReportLink}>
            Copy Client Report Link
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
            onChange={(event) => {
              clearFieldError('title');
              setForm({ ...form, title: event.target.value });
            }}
            error={fieldErrors.title}
          />

          <div className="space-y-1">
            <label className="block text-sm font-medium text-[var(--color-text-secondary)]">Description</label>
            <textarea
              className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] focus:ring-offset-2"
              rows={3}
              value={form.description || ''}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="Optional description for this form"
            />
          </div>

          <Input
            label="Header image URL"
            value={form.settings?.design?.coverImageUrl || ''}
            onChange={(event) => {
              const nextValue = event.target.value;

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
              label="Upload header image"
              type="file"
              accept="image/*"
              onChange={(event) => handleBannerFile(event.target.files?.[0])}
              helperText="Uploads to storage and replaces the URL above."
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
              className="max-h-64 w-full rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] object-cover"
              unoptimized
            />
          )}

          <Input
            label="Success modal title"
            value={form.settings?.successTitle || ''}
            onChange={(event) => updateSettings({ successTitle: event.target.value || undefined })}
            placeholder="Thank you for registering"
          />

          <Input
            label="Success modal subtitle"
            value={form.settings?.successSubtitle || ''}
            onChange={(event) => updateSettings({ successSubtitle: event.target.value || undefined })}
            placeholder="for {{formTitle}}"
          />

          <div className="space-y-1">
            <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
              Success modal message
            </label>
            <textarea
              className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] focus:ring-offset-2"
              rows={2}
              value={form.settings?.successMessage || ''}
              onChange={(event) => updateSettings({ successMessage: event.target.value || undefined })}
              placeholder="Your submission has been received."
            />
          </div>
        </div>
      </Card>

      <Card title="Registration Settings">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[var(--color-text-secondary)]">Form Type</label>
            <select
              className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
              value={formType}
              onChange={(event) =>
                updateSettings({
                  formType: event.target.value ? (event.target.value as FormSettings['formType']) : undefined,
                })
              }
            >
              <option value="">Select a type</option>
              {formTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            {fieldErrors.formType && <p className="text-sm text-[var(--color-danger-text)]">{fieldErrors.formType}</p>}
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-[var(--color-text-secondary)]">Linked Event</label>
            <select
              className="mt-1 w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
              value={form.eventId || ''}
              onChange={(event) => setForm({ ...form, eventId: event.target.value || undefined })}
              disabled={eventsLoading}
            >
              <option value="">No event attached</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Capacity"
            type="number"
            min={0}
            value={form.settings?.capacity ?? ''}
            onChange={(event) => updateSettings({ capacity: event.target.value ? Number(event.target.value) : undefined })}
          />

          <Input
            label="Closes At"
            type="datetime-local"
            value={toLocalInput(form.settings?.closesAt)}
            onChange={(event) => updateSettings({ closesAt: fromLocalInput(event.target.value) })}
          />

          <Input
            label="Expires At"
            type="datetime-local"
            value={toLocalInput(form.settings?.expiresAt)}
            onChange={(event) => updateSettings({ expiresAt: fromLocalInput(event.target.value) })}
          />
        </div>
      </Card>

      <Card title="Submission Routing">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
              Submission Target
            </label>

            <select
              className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
              value={submissionTarget}
              onChange={(event) =>
                updateSettings({
                  submissionTarget: event.target.value
                    ? (event.target.value as FormSettings['submissionTarget'])
                    : undefined,
                })
              }
            >
              <option value="">Do not route</option>
              <option value="workforce_new">Workforce - New workers</option>
              <option value="workforce_serving">Workforce - Already serving</option>
              <option value="workforce">Workforce - General</option>
              <option value="member">Member</option>
              <option value="leadership">Leadership</option>
              <option value="testimonial">Testimonial</option>
            </select>

            {fieldErrors.submissionTarget && (
              <p className="text-sm text-[var(--color-danger-text)]">{fieldErrors.submissionTarget}</p>
            )}
          </div>

          <Input
            label="Department"
            value={form.settings?.submissionDepartment ?? ''}
            onChange={(event) => updateSettings({ submissionDepartment: event.target.value })}
            placeholder="Example: Hospitality"
            disabled={!isWorkforceTarget}
            error={fieldErrors.submissionDepartment}
          />
        </div>
      </Card>

      <Card
        title="Response Email"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(`/dashboard/forms/${form.id}/response-email`)}
              icon={<MailCheck className="h-4 w-4" />}
            >
              Open Email Editor
            </Button>
            <Button
              type="button"
              onClick={() => void saveResponseEmailSettings()}
              loading={savingResponseEmail}
              icon={<Save className="h-4 w-4" />}
            >
              Save Response Settings
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {responseEmailEnabled ? 'Auto-response is enabled' : 'Auto-response is disabled'}
                </p>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  Design the confirmation email, branded header, subject, message, image, and saved template from the editor.
                </p>
              </div>
              <span className="rounded-full border border-[var(--color-border-primary)] px-3 py-1 text-xs font-semibold text-[var(--color-text-secondary)]">
                {form.settings?.responseEmailTemplateKey ? 'Template linked' : 'No template linked'}
              </span>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
            <input
              type="checkbox"
              checked={responseEmailEnabled}
              onChange={(event) => updateSettings({ responseEmailEnabled: event.target.checked })}
            />
            Enable response email
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Email subject"
              value={form.settings?.responseEmailSubject ?? ''}
              onChange={(event) => updateSettings({ responseEmailSubject: event.target.value })}
              disabled={!responseEmailEnabled}
              error={fieldErrors.responseEmailSubject}
            />

            <Input
              label="Template key"
              value={form.settings?.responseEmailTemplateKey ?? ''}
              onChange={(event) => updateSettings({ responseEmailTemplateKey: event.target.value })}
              disabled={!responseEmailEnabled}
              error={fieldErrors.responseEmailTemplateKey}
            />

            <Input
              label="Template ID"
              value={form.settings?.responseEmailTemplateId ?? ''}
              onChange={(event) => updateSettings({ responseEmailTemplateId: event.target.value })}
              disabled={!responseEmailEnabled}
              error={fieldErrors.responseEmailTemplateId}
            />

            <Input
              label="Template image URL"
              value={form.settings?.responseEmailTemplateUrl ?? ''}
              onChange={(event) => updateSettings({ responseEmailTemplateUrl: event.target.value })}
              disabled={!responseEmailEnabled}
              error={fieldErrors.responseEmailTemplateUrl}
            />
          </div>

          <p className="text-xs text-[var(--color-text-tertiary)]">
            Save response settings here for the enabled state, subject, linked template, and template image. Use the email editor to create or update the professional response template.
          </p>
        </div>
      </Card>

      <Card title="Public Content">
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="Details section title"
            value={form.settings?.introTitle ?? ''}
            onChange={(event) => updateSettings({ introTitle: event.target.value || undefined })}
          />

          <Input
            label="Details section subtitle"
            value={form.settings?.introSubtitle ?? ''}
            onChange={(event) => updateSettings({ introSubtitle: event.target.value || undefined })}
          />

          <div className="space-y-2">
            <label className="block text-sm font-medium text-[var(--color-text-secondary)]">Detail items</label>
            <textarea
              className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] focus:ring-offset-2"
              rows={5}
              value={introBulletsValue}
              onChange={(event) => updateSettings({ introBullets: splitLines(event.target.value) })}
              placeholder={'Morning session\nEvening session'}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-[var(--color-text-secondary)]">Item subtext</label>
            <textarea
              className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] focus:ring-offset-2"
              rows={5}
              value={introBulletSubtextsValue}
              onChange={(event) => updateSettings({ introBulletSubtexts: splitLines(event.target.value) })}
              placeholder={'Starts 9 A.M.\nStarts 4 P.M.'}
            />
          </div>

          <div className="space-y-4 md:col-span-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">
                  Additional content sections
                </h3>
                <p className="text-sm text-[var(--color-text-tertiary)]">
                  Add sections for schedules, requirements, speakers, directions, or FAQs.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addContentSection}
                icon={<Plus className="h-4 w-4" />}
              >
                Add Section
              </Button>
            </div>

            {contentSections.length === 0 && (
              <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-4 py-5 text-sm text-[var(--color-text-tertiary)]">
                No extra sections added.
              </div>
            )}

            {contentSections.map((section, index) => (
              <div
                key={`content-section-${index}`}
                className="space-y-4 rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm font-medium text-[var(--color-text-secondary)]">
                    Section {index + 1}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeContentSection(index)}
                    icon={<Trash2 className="h-4 w-4" />}
                  >
                    Remove
                  </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label="Section title"
                    value={section.title ?? ''}
                    onChange={(event) => updateContentSection(index, { title: event.target.value })}
                  />

                  <Input
                    label="Section subtitle"
                    value={section.subtitle ?? ''}
                    onChange={(event) => updateContentSection(index, { subtitle: event.target.value })}
                  />

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
                      Section items
                    </label>
                    <textarea
                      className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] focus:ring-offset-2"
                      rows={5}
                      value={(section.items ?? []).join('\n')}
                      onChange={(event) => updateContentSection(index, { items: splitLines(event.target.value) ?? [] })}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
                      Item subtext
                    </label>
                    <textarea
                      className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] focus:ring-offset-2"
                      rows={5}
                      value={(section.itemSubtexts ?? []).join('\n')}
                      onChange={(event) =>
                        updateContentSection(index, {
                          itemSubtexts: event.target.value.split('\n').map((item) => item.trim()),
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
              Form header note
            </label>
            <textarea
              className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] focus:ring-offset-2"
              rows={3}
              value={form.settings?.formHeaderNote ?? ''}
              onChange={(event) => updateSettings({ formHeaderNote: event.target.value || undefined })}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[var(--color-text-secondary)]">Layout</label>
              <select
                className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                value={form.settings?.layoutMode ?? 'split'}
                onChange={(event) => updateSettings({ layoutMode: event.target.value === 'stack' ? 'stack' : 'split' })}
              >
                <option value="split">Two column layout</option>
                <option value="stack">Single column layout</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-[var(--color-text-secondary)]">Date format</label>
              <select
                className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                value={form.settings?.dateFormat ?? 'dd/mm'}
                onChange={(event) =>
                  updateSettings({
                    dateFormat: event.target.value as NonNullable<FormSettings['dateFormat']>,
                  })
                }
              >
                <option value="yyyy-mm-dd">YYYY-MM-DD</option>
                <option value="mm/dd/yyyy">MM/DD/YYYY</option>
                <option value="dd/mm/yyyy">DD/MM/YYYY</option>
                <option value="dd/mm">DD/MM</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Fields">
        <div className="space-y-5">
          <FormFieldOrderBuilder<FieldDraft>
            fields={fields}
            onChange={(nextFields) => setFields(normalizeOrderedFields(nextFields))}
            title="Arrange public form fields"
              description="Drag fields into the exact order members should see on the public form. The saved form order will follow this arrangement."
          />

          {orderedFields.map((field, index) => (
            <FieldEditor
              key={`${field.key || 'field'}-${index}`}
              field={field}
              index={index}
              allFields={orderedFields}
              onChange={(updates) => updateField(index, updates)}
              onRemove={() => requestRemoveField(index)}
            />
          ))}

          <Button variant="outline" onClick={addField} icon={<Plus className="h-4 w-4" />}>
            Add Field
          </Button>
        </div>
      </Card>

      <Card title="Preview Link">
        {(() => {
          const publicUrl = buildPublicFormUrl(form.slug, form.publicUrl);
          return (
            <div className="flex flex-col gap-3 rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="min-w-0 break-all font-mono text-sm text-[var(--color-text-primary)]">
                {publicUrl || 'Publish this form to generate its public link.'}
              </p>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button variant="outline" size="sm" disabled={!publicUrl} onClick={copyLink} icon={<Copy className="h-4 w-4" />}>
                  Copy
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!publicUrl}
                  onClick={() => publicUrl && window.open(publicUrl, '_blank', 'noopener,noreferrer')}
                  icon={<ExternalLink className="h-4 w-4" />}
                >
                  Open
                </Button>
              </div>
            </div>
          );
        })()}
      </Card>

      <AlertModal
        open={removeFieldIndex !== null}
        onClose={() => setRemoveFieldIndex(null)}
        title="Remove Field"
        description={`Remove "${pendingField?.label || 'this field'}"? This will delete it from the form.`}
        primaryAction={{ label: 'Remove', onClick: confirmRemoveField, variant: 'danger' }}
        secondaryAction={{
          label: 'Cancel',
          onClick: () => setRemoveFieldIndex(null),
          variant: 'outline',
        }}
      />
    </div>
  );
}

export default withAuth(EditFormPage, { requiredRole: 'admin' });
