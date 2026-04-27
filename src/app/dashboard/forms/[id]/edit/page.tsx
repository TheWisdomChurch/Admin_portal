'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Plus, Trash2, Copy, Save, Globe, Mail, Send } from 'lucide-react';

import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Input } from '@/ui/input';
import { PageHeader } from '@/layouts';
import { AlertModal } from '@/ui/AlertModal';

import { apiClient } from '@/lib/api';
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
  FormFieldCondition,
  FormFieldType,
  FormFieldVisibility,
  FormSettings,
  UpdateFormRequest,
} from '@/lib/types';

import { withAuth } from '@/providers/withAuth';

type FieldDraft = Omit<FormField, 'id'>;
type VisibilityRuleDraft = FormFieldCondition;

const MAX_BANNER_MB = 5;
const MAX_BANNER_BYTES = MAX_BANNER_MB * 1024 * 1024;
const ACCEPTED_BANNER_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const visibilityOperatorOptions: Array<{
  value: VisibilityRuleDraft['operator'];
  label: string;
}> = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Does not equal' },
  { value: 'in', label: 'Matches any' },
  { value: 'not_in', label: 'Matches none' },
];

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

function isOptionField(type: FormFieldType) {
  return type === 'select' || type === 'radio' || type === 'checkbox';
}

function slugifyOptionValue(label: string, fallback: string) {
  return (
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || fallback
  );
}

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

function ensureOptions(field: FieldDraft): FieldDraft {
  if (!isOptionField(field.type)) {
    return { ...field, options: undefined };
  }

  const options = Array.isArray(field.options) ? field.options : [];
  if (options.length > 0) return { ...field, options };

  return {
    ...field,
    options: [
      { label: 'Option 1', value: 'option-1' },
      { label: 'Option 2', value: 'option-2' },
    ],
  };
}

function normalizeFieldOptions(field: FieldDraft) {
  if (!isOptionField(field.type)) return undefined;

  const normalized = (field.options || [])
    .map((option, index) => {
      const label = (option.label || '').trim();
      if (!label) return null;

      return {
        label,
        value: slugifyOptionValue(option.value || label, `option-${index + 1}`),
      };
    })
    .filter((option): option is { label: string; value: string } => option !== null);

  return normalized.length > 0 ? normalized : undefined;
}

function createEmptyVisibilityRule(): VisibilityRuleDraft {
  return {
    fieldKey: '',
    operator: 'equals',
    value: '',
  };
}

function usesVisibilityList(operator: VisibilityRuleDraft['operator']) {
  return operator === 'in' || operator === 'not_in';
}

function sanitizeVisibilityValue(value: unknown): string | number | boolean | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }

  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'boolean') return value;

  return undefined;
}

function sanitizeFieldVisibility(visibility?: FormFieldVisibility): FormFieldVisibility | undefined {
  if (!visibility || !Array.isArray(visibility.rules) || visibility.rules.length === 0) {
    return undefined;
  }

  const rules = visibility.rules.reduce<VisibilityRuleDraft[]>((acc, rule) => {
    const fieldKey = typeof rule.fieldKey === 'string' ? rule.fieldKey.trim() : '';
    if (!fieldKey) return acc;

    const operator: VisibilityRuleDraft['operator'] = visibilityOperatorOptions.some(
      (item) => item.value === rule.operator
    )
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

  if (rules.length === 0) return undefined;

  return {
    match: visibility.match === 'any' ? 'any' : 'all',
    rules,
  };
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

    const loadForm = async () => {
      try {
        const res = await apiClient.getAdminForm(formId);
        setForm(res);
        setFields(applyImplicitYesVisibilityDefaults(res.fields || []).map(ensureOptions));
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
          return ensureOptions(next);
        }

        return next;
      })
    );
  };

  const addFieldOption = (fieldIndex: number) => {
    setFields((prev) =>
      prev.map((field, index) => {
        if (index !== fieldIndex) return field;

        const current = ensureOptions(field);
        const options = current.options || [];
        const nextNumber = options.length + 1;

        return {
          ...current,
          options: [
            ...options,
            {
              label: `Option ${nextNumber}`,
              value: `option-${nextNumber}`,
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

        const current = ensureOptions(field);
        const options = [...(current.options || [])];

        if (!options[optionIndex]) return current;

        options[optionIndex] = {
          label,
          value: slugifyOptionValue(label, `option-${optionIndex + 1}`),
        };

        return {
          ...current,
          options,
        };
      })
    );
  };

  const removeFieldOption = (fieldIndex: number, optionIndex: number) => {
    setFields((prev) =>
      prev.map((field, index) => {
        if (index !== fieldIndex) return field;

        const current = ensureOptions(field);
        const options = [...(current.options || [])];

        if (options.length <= 1) {
          toast.error('An option field must keep at least one option.');
          return current;
        }

        options.splice(optionIndex, 1);

        return {
          ...current,
          options,
        };
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

        const nextVisibility =
          sanitizeFieldVisibility(field.visibility) ||
          buildImplicitYesVisibility(prev, index) || {
            match: 'all' as const,
            rules: [createEmptyVisibilityRule()],
          };

        return { ...field, visibility: nextVisibility };
      })
    );
  };

  const updateFieldVisibility = (index: number, updates: Partial<FormFieldVisibility>) => {
    setFields((prev) =>
      prev.map((field, fieldIndex) => {
        if (fieldIndex !== index) return field;

        const currentVisibility = field.visibility || {
          match: 'all' as const,
          rules: [createEmptyVisibilityRule()],
        };

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

        const currentVisibility = field.visibility || {
          match: 'all' as const,
          rules: [createEmptyVisibilityRule()],
        };

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

        const currentVisibility = field.visibility || { match: 'all' as const, rules: [] };

        return {
          ...field,
          visibility: {
            match: currentVisibility.match === 'any' ? 'any' : 'all',
            rules: [...(currentVisibility.rules || []), createEmptyVisibilityRule()],
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
      {
        key: `field_${order}`,
        label: 'New field',
        type: 'text',
        required: false,
        order,
      },
    ]);
  };

  const requestRemoveField = (index: number) => {
    setRemoveFieldIndex(index);
  };

  const confirmRemoveField = () => {
    if (removeFieldIndex === null) return;

    setFields((prev) =>
      prev.filter((_, index) => index !== removeFieldIndex).map((field, index) => ({
        ...field,
        order: index + 1,
      }))
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

      if (isOptionField(field.type)) {
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
      fields: fields.map((field, index) => ({
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
      setFields(applyImplicitYesVisibilityDefaults(updated.fields || []).map(ensureOptions));

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
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-solid border-primary-600 border-r-transparent" />
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
  const pendingField = removeFieldIndex !== null ? fields[removeFieldIndex] : null;

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

            {fieldErrors.formType && <p className="text-sm text-red-500">{fieldErrors.formType}</p>}
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
              <p className="text-sm text-red-500">{fieldErrors.submissionTarget}</p>
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

      <Card title="Response Email">
        <div className="space-y-4">
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
            Attach a response template to send a confirmation email after successful submission.
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
                      className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-white px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] focus:ring-offset-2"
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
                      className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-white px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] focus:ring-offset-2"
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
        <div className="space-y-4">
          {fields.map((field, index) => {
            const visibilityRules = Array.isArray(field.visibility?.rules) ? field.visibility.rules : [];
            const visibilityEnabled = visibilityRules.length > 0;
            const targetFields = getVisibilityTargetFields(index);

            return (
              <div
                key={`${field.key || 'field'}-${index}`}
                className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Input
                    label="Label"
                    value={field.label}
                    onChange={(event) => updateField(index, { label: event.target.value })}
                  />

                  <div className="flex flex-wrap gap-2">
                    <select
                      value={field.type}
                      onChange={(event) => updateField(index, { type: event.target.value as FormFieldType })}
                      className="rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
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
                        onChange={(event) => updateField(index, { required: event.target.checked })}
                      />
                      Required
                    </label>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => requestRemoveField(index)}
                      icon={<Trash2 className="h-4 w-4" />}
                    >
                      Remove
                    </Button>
                  </div>
                </div>

                {isOptionField(field.type) && (
                  <div className="mt-4 space-y-3 rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[var(--color-text-primary)]">Options</p>
                        <p className="text-xs text-[var(--color-text-tertiary)]">
                          Add each dropdown, radio, or checkbox option separately.
                        </p>
                      </div>

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

                    <div className="space-y-2">
                      {(field.options || []).map((option, optionIndex) => (
                        <div key={`${field.key || index}-option-${optionIndex}`} className="flex items-center gap-2">
                          <input
                            className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                            value={option.label}
                            onChange={(event) => updateFieldOptionLabel(index, optionIndex, event.target.value)}
                            placeholder={`Option ${optionIndex + 1}`}
                          />

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeFieldOption(index, optionIndex)}
                            disabled={(field.options || []).length <= 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-3 rounded-[var(--radius-card)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] p-3">
                  <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                    <input
                      type="checkbox"
                      checked={visibilityEnabled}
                      onChange={(event) => setFieldVisibilityEnabled(index, event.target.checked)}
                    />
                    Show this field conditionally
                  </label>

                  {visibilityEnabled && (
                    <div className="mt-3 space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <label className="block text-xs font-medium text-[var(--color-text-tertiary)]">
                            Rule matching
                          </label>

                          <select
                            className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                            value={field.visibility?.match === 'any' ? 'any' : 'all'}
                            onChange={(event) =>
                              updateFieldVisibility(index, {
                                match: event.target.value === 'any' ? 'any' : 'all',
                              })
                            }
                          >
                            <option value="all">All conditions must pass</option>
                            <option value="any">Any condition can pass</option>
                          </select>
                        </div>

                        <div className="flex items-end">
                          <p className="text-xs text-[var(--color-text-tertiary)]">
                            Use conditional fields when a follow-up question should only appear after a specific answer.
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
                        const listValue = Array.isArray(rule.values)
                          ? rule.values.map((value) => String(value)).join(', ')
                          : '';
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
                                  onChange={(event) =>
                                    updateFieldVisibilityRule(index, ruleIndex, {
                                      fieldKey: event.target.value,
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
                                  onChange={(event) => {
                                    const nextOperator = event.target.value as VisibilityRuleDraft['operator'];

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
                                    onChange={(event) =>
                                      updateFieldVisibilityRule(index, ruleIndex, {
                                        value: event.target.value,
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
                                    onChange={(event) =>
                                      updateFieldVisibilityRule(
                                        index,
                                        ruleIndex,
                                        useListInput
                                          ? {
                                              values: event.target.value
                                                .split(',')
                                                .map((value) => value.trim())
                                                .filter(Boolean),
                                            }
                                          : {
                                              value: event.target.value,
                                            }
                                      )
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

                      <Button variant="outline" size="sm" onClick={() => addFieldVisibilityRule(index)}>
                        Add Condition
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

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