'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Input } from '@/ui/input';
import { PageHeader } from '@/layouts';
import { apiClient } from '@/lib/api';
import { buildFormSubmissionsReportPath, copyFormSubmissionsReportLink } from '@/lib/formSubmissions';
import { buildPublicFormUrl } from '@/lib/utils';
import type {
  AdminForm,
  EventData,
  FormContentSection,
  FormField,
  FormFieldCondition,
  FormFieldType,
  FormFieldVisibility,
  FormSettings,
  UpdateFormRequest,
} from '@/lib/types';
import { withAuth } from '@/providers/withAuth';
import toast from 'react-hot-toast';
import { Plus, Trash2, Copy, Save, Globe, Mail, Send } from 'lucide-react';
import { extractServerFieldErrors, getFirstServerFieldError, getServerErrorMessage } from '@/lib/serverValidation';
import { AlertModal } from '@/ui/AlertModal';

type FieldDraft = Omit<FormField, 'id'>;
type VisibilityRuleDraft = FormFieldCondition;

const MAX_BANNER_MB = 5;
const MAX_BANNER_BYTES = MAX_BANNER_MB * 1024 * 1024;
const ACCEPTED_BANNER_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const visibilityOperatorOptions: Array<{ value: VisibilityRuleDraft['operator']; label: string }> = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Does not equal' },
  { value: 'in', label: 'Matches any' },
  { value: 'not_in', label: 'Matches none' },
];
const formTypeOptions: Array<{ value: NonNullable<FormSettings['formType']>; label: string }> = [
  { value: 'registration', label: 'Registration' },
  { value: 'event', label: 'Event' },
  { value: 'membership', label: 'Membership' },
  { value: 'workforce', label: 'Workforce' },
  { value: 'leadership', label: 'Leadership' },
  { value: 'application', label: 'Application' },
  { value: 'contact', label: 'Contact' },
  { value: 'general', label: 'General' },
];
const isOptionFieldType = (type: FormFieldType) => type === 'select' || type === 'radio' || type === 'checkbox';
const toOptionValue = (label: string, index: number) =>
  label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || `option-${index + 1}`;

function createEmptyVisibilityRule(): VisibilityRuleDraft {
  return {
    fieldKey: '',
    operator: 'equals',
    value: '',
  };
}

function usesVisibilityList(operator: VisibilityRuleDraft['operator']): boolean {
  return operator === 'in' || operator === 'not_in';
}

function sanitizeVisibilityValue(value: unknown): string | number | boolean | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  return undefined;
}

function sanitizeFieldVisibility(visibility?: FormFieldVisibility): FormFieldVisibility | undefined {
  if (!visibility || !Array.isArray(visibility.rules) || visibility.rules.length === 0) {
    return undefined;
  }

  const rules = visibility.rules.reduce<VisibilityRuleDraft[]>((acc, rule) => {
    const fieldKey = typeof rule.fieldKey === 'string' ? rule.fieldKey.trim() : '';
    if (!fieldKey) return acc;

    const operator: VisibilityRuleDraft['operator'] = visibilityOperatorOptions.some((item) => item.value === rule.operator)
      ? rule.operator
      : 'equals';

    if (usesVisibilityList(operator)) {
      const values = Array.isArray(rule.values)
        ? rule.values
            .map((value) => sanitizeVisibilityValue(value))
            .filter((value): value is string | number | boolean => typeof value !== 'undefined')
        : [];
      if (values.length === 0) return acc;
      acc.push({ fieldKey, operator, values });
      return acc;
    }

    const value = sanitizeVisibilityValue(rule.value);
    if (typeof value === 'undefined') return acc;
    acc.push({ fieldKey, operator, value });
    return acc;
  }, []);

  if (rules.length === 0) {
    return undefined;
  }

  return {
    match: visibility.match === 'any' ? 'any' : 'all',
    rules,
  };
}

function normalizeVisibilityToken(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function isAffirmativeOption(value: string): boolean {
  const token = normalizeVisibilityToken(value);
  return token === 'yes' || token === 'true' || token === '1';
}

function isNegativeOption(value: string): boolean {
  const token = normalizeVisibilityToken(value);
  return token === 'no' || token === 'false' || token === '0';
}

function looksLikeIfYesLabel(label: string): boolean {
  return /^\s*if\s+yes\b/i.test(label);
}

function findYesOptionValue(field: Pick<FormField, 'type' | 'options'>): string | undefined {
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
    if (sanitizeFieldVisibility(field.visibility)) {
      return field;
    }

    const suggestedVisibility = buildImplicitYesVisibility(fields, index);
    if (!suggestedVisibility) {
      return field;
    }

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
  const [saving, setSaving] = useState(false);
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
    (async () => {
      try {
        const res = await apiClient.getAdminForm(formId);
        setForm(res);
        setFields(applyImplicitYesVisibilityDefaults(res.fields || []));
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

  const addFieldOption = (fieldIndex: number) => {
    setFields((prev) =>
      prev.map((field, index) => {
        if (index !== fieldIndex) return field;
        const options = Array.isArray(field.options) ? field.options : [];
        const nextIndex = options.length;
        return {
          ...field,
          options: [
            ...options,
            {
              label: '',
              value: `option-${nextIndex + 1}`,
            },
          ],
        };
      })
    );
  };

  const updateFieldOptionLabel = (fieldIndex: number, optionIndex: number, label: string) => {
    setFields((prev) =>
      prev.map((field, index) => {
        if (index !== fieldIndex) return field;
        const options = Array.isArray(field.options) ? [...field.options] : [];
        if (!options[optionIndex]) return field;
        options[optionIndex] = {
          label,
          value: toOptionValue(label, optionIndex),
        };
        return { ...field, options };
      })
    );
  };

  const removeFieldOption = (fieldIndex: number, optionIndex: number) => {
    setFields((prev) =>
      prev.map((field, index) => {
        if (index !== fieldIndex) return field;
        const options = Array.isArray(field.options) ? [...field.options] : [];
        if (!options[optionIndex]) return field;
        options.splice(optionIndex, 1);
        return { ...field, options };
      })
    );
  };

  const setFieldVisibilityEnabled = (index: number, enabled: boolean) => {
    setFields((prev) =>
      prev.map((field, fieldIndex) => {
        if (fieldIndex !== index) return field;
        if (!enabled) {
          return { ...field, visibility: undefined };
        }

        const nextVisibility = (
          sanitizeFieldVisibility(field.visibility) ??
          buildImplicitYesVisibility(prev, index) ??
          {
            match: 'all' as const,
            rules: [createEmptyVisibilityRule()],
          }
        );
        return { ...field, visibility: nextVisibility };
      })
    );
  };

  const updateFieldVisibility = (index: number, updates: Partial<FormFieldVisibility>) => {
    setFields((prev) =>
      prev.map((field, fieldIndex) => {
        if (fieldIndex !== index) return field;
        const currentVisibility = field.visibility ?? { match: 'all' as const, rules: [createEmptyVisibilityRule()] };
        return {
          ...field,
          visibility: {
            ...currentVisibility,
            ...updates,
          },
        };
      })
    );
  };

  const updateFieldVisibilityRule = (
    fieldIndex: number,
    ruleIndex: number,
    updates: Partial<VisibilityRuleDraft>
  ) => {
    setFields((prev) =>
      prev.map((field, currentFieldIndex) => {
        if (currentFieldIndex !== fieldIndex) return field;
        const currentVisibility = field.visibility ?? { match: 'all' as const, rules: [createEmptyVisibilityRule()] };
        const rules = Array.isArray(currentVisibility.rules) ? [...currentVisibility.rules] : [];
        if (!rules[ruleIndex]) return field;

        rules[ruleIndex] = {
          ...rules[ruleIndex],
          ...updates,
        };

        return {
          ...field,
          visibility: {
            ...currentVisibility,
            rules,
          },
        };
      })
    );
  };

  const addFieldVisibilityRule = (fieldIndex: number) => {
    setFields((prev) =>
      prev.map((field, currentFieldIndex) => {
        if (currentFieldIndex !== fieldIndex) return field;
        const currentVisibility = field.visibility ?? { match: 'all' as const, rules: [] };
        return {
          ...field,
          visibility: {
            match: currentVisibility.match === 'any' ? 'any' : 'all',
            rules: [...(currentVisibility.rules ?? []), createEmptyVisibilityRule()],
          },
        };
      })
    );
  };

  const removeFieldVisibilityRule = (fieldIndex: number, ruleIndex: number) => {
    setFields((prev) =>
      prev.map((field, currentFieldIndex) => {
        if (currentFieldIndex !== fieldIndex) return field;
        const currentVisibility = field.visibility;
        if (!currentVisibility?.rules?.length) return field;

        const rules = currentVisibility.rules.filter((_, index) => index !== ruleIndex);
        if (rules.length === 0) {
          return {
            ...field,
            visibility: undefined,
          };
        }

        return {
          ...field,
          visibility: {
            match: currentVisibility.match === 'any' ? 'any' : 'all',
            rules,
          },
        };
      })
    );
  };

  const getVisibilityTargetFields = (currentIndex: number) =>
    fields.filter((field, index) => index !== currentIndex && Boolean(field.key?.trim()));

  const getVisibilityTargetOptions = (fieldKey: string) => {
    const target = fields.find((field) => field.key === fieldKey);
    return Array.isArray(target?.options) ? target.options : [];
  };

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
    const sanitizedSettings = form.settings
      ? {
          ...form.settings,
          contentSections: sanitizeContentSections(form.settings.contentSections),
          responseEmailEnabled: true,
        }
      : { responseEmailEnabled: true };
    const payload: UpdateFormRequest = {
      title: form.title.trim(),
      description: form.description?.trim() || undefined,
      slug: form.slug,
      eventId: form.eventId,
      fields: fields.map((f, idx) => ({
        ...f,
        key: (f.key || `field_${idx + 1}`).trim(),
        label: f.label.trim(),
        visibility: sanitizeFieldVisibility(f.visibility),
        order: idx + 1,
      })),
      settings: sanitizedSettings,
    };
    try {
      const updated = await apiClient.updateAdminForm(form.id, payload);
      setForm(updated);
      setFields(applyImplicitYesVisibilityDefaults(updated.fields || []));
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
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-solid border-primary-600 border-r-transparent" />
      </div>
    );
  }

  if (!form) return null;

  const formType = form.settings?.formType ?? '';
  const submissionTarget = form.settings?.submissionTarget ?? '';
  const isWorkforceTarget =
    submissionTarget === 'workforce' ||
    submissionTarget === 'workforce_new' ||
    submissionTarget === 'workforce_serving';
  const introBulletsValue = (form.settings?.introBullets ?? []).join('\n');
  const introBulletSubtextsValue = (form.settings?.introBulletSubtexts ?? []).join('\n');
  const contentSections = form.settings?.contentSections ?? [];

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
        <PageHeader
          title="Edit Form"
          subtitle="Adjust fields, then save and publish."
        />
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
          <Button
            variant="outline"
            onClick={() => router.push(buildFormSubmissionsReportPath(form.id))}
          >
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
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Form Type</label>
            <select
              className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
              value={formType}
              onChange={(e) =>
                updateSettings({
                  formType: e.target.value ? (e.target.value as FormSettings['formType']) : undefined,
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
            {fieldErrors.formType && <p className="text-sm text-red-500">{fieldErrors.formType}</p>}
          </div>

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
              <option value="workforce_new">Workforce (new workers)</option>
              <option value="workforce_serving">Workforce (already serving)</option>
              <option value="workforce">Workforce (legacy)</option>
              <option value="member">Membership (members)</option>
              <option value="leadership">Leadership applications</option>
              <option value="testimonial">Testimonials</option>
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
            disabled={!isWorkforceTarget}
            error={fieldErrors.submissionDepartment}
          />
        </div>
      </Card>

      <Card title="Response Email">
        <div className="space-y-4">
          <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
            <input
              type="checkbox"
              checked
              disabled
              readOnly
            />
            Response email is mandatory
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Email subject"
              value={form.settings?.responseEmailSubject ?? ''}
              onChange={(e) => updateSettings({ responseEmailSubject: e.target.value })}
              error={fieldErrors.responseEmailSubject}
            />
            <Input
              label="Template key"
              value={form.settings?.responseEmailTemplateKey ?? ''}
              onChange={(e) => updateSettings({ responseEmailTemplateKey: e.target.value })}
              error={fieldErrors.responseEmailTemplateKey}
            />
            <Input
              label="Template ID (optional)"
              value={form.settings?.responseEmailTemplateId ?? ''}
              onChange={(e) => updateSettings({ responseEmailTemplateId: e.target.value })}
              error={fieldErrors.responseEmailTemplateId}
            />
            <Input
              label="Template image URL (optional)"
              value={form.settings?.responseEmailTemplateUrl ?? ''}
              onChange={(e) => updateSettings({ responseEmailTemplateUrl: e.target.value })}
              error={fieldErrors.responseEmailTemplateUrl}
            />
          </div>
          <p className="text-xs text-[var(--color-text-tertiary)]">
            Use template key/ID from Email Templates registry, or provide a direct template image URL.
          </p>
        </div>
      </Card>

      <Card title="Public Content">
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="Details section title"
            value={form.settings?.introTitle ?? ''}
            onChange={(e) => updateSettings({ introTitle: e.target.value || undefined })}
            helperText="Use this area for custom content like WPC26 schedule or registration highlights."
          />

          <Input
            label="Details section subtitle"
            value={form.settings?.introSubtitle ?? ''}
            onChange={(e) => updateSettings({ introSubtitle: e.target.value || undefined })}
            helperText="Short supporting line shown above the detail items."
          />

          <div className="space-y-2">
            <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
              Detail items
            </label>
            <textarea
              className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] focus:ring-offset-2"
              rows={5}
              value={introBulletsValue}
              onChange={(e) => updateSettings({ introBullets: splitLines(e.target.value) })}
              placeholder={'Morning session\nEvening session'}
            />
            <p className="text-sm text-[var(--color-text-tertiary)]">
              Add one item per line. Example: `Morning session`, `Evening session`.
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
              Item subtext
            </label>
            <textarea
              className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] focus:ring-offset-2"
              rows={5}
              value={introBulletSubtextsValue}
              onChange={(e) => updateSettings({ introBulletSubtexts: splitLines(e.target.value) })}
              placeholder={'Starts 9 A.M.\nStarts 4 P.M.'}
            />
            <p className="text-sm text-[var(--color-text-tertiary)]">
              Each line matches the item in the same position. Example: `Starts 9 A.M.` for `Morning session`.
            </p>
          </div>

          <div className="space-y-4 md:col-span-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">Additional content sections</h3>
                <p className="text-sm text-[var(--color-text-tertiary)]">
                  Add repeatable sections for schedules, directions, requirements, speakers, or FAQs.
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

            {contentSections.length === 0 ? (
              <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-4 py-5 text-sm text-[var(--color-text-tertiary)]">
                No extra sections added yet. Use this when a form needs more than the main details block.
              </div>
            ) : null}

            {contentSections.map((section, index) => (
              <div
                key={`content-section-${index}`}
                className="space-y-4 rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm font-medium text-[var(--color-text-secondary)]">Section {index + 1}</div>
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
                    onChange={(e) => updateContentSection(index, { title: e.target.value })}
                  />
                  <Input
                    label="Section subtitle"
                    value={section.subtitle ?? ''}
                    onChange={(e) => updateContentSection(index, { subtitle: e.target.value })}
                  />

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
                      Section items
                    </label>
                    <textarea
                      className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-white px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] focus:ring-offset-2"
                      rows={5}
                      value={(section.items ?? []).join('\n')}
                      onChange={(e) => updateContentSection(index, { items: splitLines(e.target.value) ?? [] })}
                      placeholder={'Arrival and accreditation\nMain auditorium opens\nNetworking dinner'}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
                      Item subtext
                    </label>
                    <textarea
                      className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-white px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] focus:ring-offset-2"
                      rows={5}
                      value={(section.itemSubtexts ?? []).join('\n')}
                      onChange={(e) =>
                        updateContentSection(index, {
                          itemSubtexts: e.target.value.split('\n').map((item) => item.trim()),
                        })
                      }
                      placeholder={'8:00 A.M.\n9:00 A.M.\n6:00 P.M.'}
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
              onChange={(e) => updateSettings({ formHeaderNote: e.target.value || undefined })}
              placeholder="Optional note shown above the form fields."
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
                Layout
              </label>
              <select
                className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                value={form.settings?.layoutMode ?? 'split'}
                onChange={(e) =>
                  updateSettings({ layoutMode: e.target.value === 'stack' ? 'stack' : 'split' })
                }
              >
                <option value="split">Two column layout</option>
                <option value="stack">Single column layout</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
                Date format
              </label>
              <select
                className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                value={form.settings?.dateFormat ?? 'dd-mm'}
                onChange={(e) =>
                  updateSettings({
                    dateFormat: e.target.value as NonNullable<FormSettings['dateFormat']>,
                  })
                }
              >
                <option value="dd-mm">DD-MM</option>
                <option value="dd/mm">DD/MM</option>
              </select>
            </div>
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
              {(() => {
                const visibilityRules = Array.isArray(field.visibility?.rules) ? field.visibility.rules : [];
                const visibilityEnabled = visibilityRules.length > 0;
                const targetFields = getVisibilityTargetFields(index);

                return (
                  <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Input
                  label="Label"
                  value={field.label}
                  onChange={(e) => updateField(index, { label: e.target.value })}
                />
                <div className="flex flex-wrap gap-2">
                  <select
                    value={field.type}
                    onChange={(e) => {
                      const nextType = e.target.value as FormFieldType;
                      const nextOptions =
                        isOptionFieldType(nextType) && (!Array.isArray(field.options) || field.options.length === 0)
                          ? [
                              { label: 'Option 1', value: 'option-1' },
                              { label: 'Option 2', value: 'option-2' },
                            ]
                          : isOptionFieldType(nextType)
                          ? field.options
                          : undefined;
                      updateField(index, { type: nextType, options: nextOptions });
                    }}
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
              {field.type === 'textarea' && (
                <div className="mt-3 max-w-xs">
                  <Input
                    label="Max words (optional)"
                    type="number"
                    min={1}
                    value={field.validation?.maxWords ?? ''}
                    onChange={(e) =>
                      updateField(index, {
                        validation: {
                          ...(field.validation || {}),
                          maxWords: e.target.value ? Number(e.target.value) : undefined,
                        },
                      })
                    }
                    placeholder="e.g., 400"
                  />
                </div>
              )}

              {isOptionFieldType(field.type) && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-[var(--color-text-tertiary)]">Options</p>
                  {(field.options || []).map((option, optionIndex) => (
                    <div key={`${option.value}-${optionIndex}`} className="flex items-center gap-2">
                      <input
                        className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm"
                        value={option.label}
                        onChange={(e) => updateFieldOptionLabel(index, optionIndex, e.target.value)}
                        placeholder={`Option ${optionIndex + 1}`}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeFieldOption(index, optionIndex)}
                        icon={<Trash2 className="h-4 w-4" />}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addFieldOption(index)}
                    icon={<Plus className="h-4 w-4" />}
                  >
                    Add option
                  </Button>
                </div>
              )}
              <div className="mt-3 rounded-[var(--radius-card)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] p-3">
                <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                  <input
                    type="checkbox"
                    checked={visibilityEnabled}
                    onChange={(e) => setFieldVisibilityEnabled(index, e.target.checked)}
                  />
                  Show this field conditionally
                </label>

                {visibilityEnabled ? (
                  <div className="mt-3 space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-[var(--color-text-tertiary)]">
                          Rule matching
                        </label>
                        <select
                          className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                          value={field.visibility?.match === 'any' ? 'any' : 'all'}
                          onChange={(e) =>
                            updateFieldVisibility(index, {
                              match: e.target.value === 'any' ? 'any' : 'all',
                            })
                          }
                        >
                          <option value="all">All conditions must pass</option>
                          <option value="any">Any condition can pass</option>
                        </select>
                      </div>
                      <div className="flex items-end">
                        <p className="text-xs text-[var(--color-text-tertiary)]">
                          Example: show &quot;Preferred unit&quot; only when the volunteer field matches the
                          &quot;Yes&quot; option.
                        </p>
                      </div>
                    </div>

                    {visibilityRules.map((rule, ruleIndex) => {
                      const targetOptions = getVisibilityTargetOptions(rule.fieldKey);
                      const useListInput = usesVisibilityList(rule.operator);
                      const scalarValue =
                        typeof rule.value === 'string'
                          ? rule.value
                          : typeof rule.value === 'number' || typeof rule.value === 'boolean'
                          ? String(rule.value)
                          : '';
                      const listValue = Array.isArray(rule.values) ? rule.values.map((value) => String(value)).join(', ') : '';
                      const canUseOptionSelect = !useListInput && targetOptions.length > 0;

                      return (
                        <div
                          key={`${field.key || index}-visibility-${ruleIndex}`}
                          className="rounded-[var(--radius-card)] border border-[var(--color-border-primary)] bg-[var(--color-background-primary)] p-3"
                        >
                          <div className="grid gap-3 lg:grid-cols-3">
                            <div className="space-y-1">
                              <label className="block text-xs font-medium text-[var(--color-text-tertiary)]">
                                When field
                              </label>
                              <select
                                className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                                value={rule.fieldKey}
                                onChange={(e) =>
                                  updateFieldVisibilityRule(index, ruleIndex, {
                                    fieldKey: e.target.value,
                                  })
                                }
                              >
                                <option value="">Select a field</option>
                                {targetFields.map((targetField) => (
                                  <option key={targetField.key} value={targetField.key}>
                                    {targetField.label || targetField.key}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="space-y-1">
                              <label className="block text-xs font-medium text-[var(--color-text-tertiary)]">
                                Condition
                              </label>
                              <select
                                className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                                value={rule.operator}
                                onChange={(e) => {
                                  const nextOperator = e.target.value as VisibilityRuleDraft['operator'];
                                  updateFieldVisibilityRule(index, ruleIndex, {
                                    operator: nextOperator,
                                    value: usesVisibilityList(nextOperator) ? undefined : '',
                                    values: usesVisibilityList(nextOperator) ? [] : undefined,
                                  });
                                }}
                              >
                                {visibilityOperatorOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="space-y-1">
                              <label className="block text-xs font-medium text-[var(--color-text-tertiary)]">
                                Value
                              </label>
                              {canUseOptionSelect ? (
                                <select
                                  className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                                  value={scalarValue}
                                  onChange={(e) =>
                                    updateFieldVisibilityRule(index, ruleIndex, {
                                      value: e.target.value,
                                    })
                                  }
                                >
                                  <option value="">Select a value</option>
                                  {targetOptions.map((option) => (
                                    <option key={`${option.value}-${option.label}`} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                                  value={useListInput ? listValue : scalarValue}
                                  onChange={(e) =>
                                    updateFieldVisibilityRule(index, ruleIndex, useListInput
                                      ? {
                                          values: e.target.value
                                            .split(',')
                                            .map((value) => value.trim())
                                            .filter(Boolean),
                                        }
                                      : {
                                          value: e.target.value,
                                        })
                                  }
                                  placeholder={useListInput ? 'yes, maybe' : 'yes'}
                                />
                              )}
                            </div>
                          </div>

                          <div className="mt-3 flex justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => removeFieldVisibilityRule(index, ruleIndex)}
                            >
                              Remove Condition
                            </Button>
                          </div>
                        </div>
                      );
                    })}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addFieldVisibilityRule(index)}
                    >
                      Add Condition
                    </Button>
                  </div>
                ) : null}
              </div>
                  </>
                );
              })()}
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
            {buildPublicFormUrl(form.slug, form.publicUrl) || 'Publish to generate link'}
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
