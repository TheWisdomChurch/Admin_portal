// src/app/dashboard/forms/page.tsx
'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Plus, Link as LinkIcon, Save, Copy, Trash2 } from 'lucide-react';

import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { DataTable } from '@/components/DateTable';
import { PageHeader } from '@/layouts';
import { Input } from '@/ui/input';
import { VerifyActionModal } from '@/ui/VerifyActionModal';

import { apiClient } from '@/lib/api';
import type { AdminForm, CreateFormRequest, EventData, FormFieldType, FormSettings, FormStatsResponse } from '@/lib/types';

import { withAuth } from '@/providers/withAuth';
import { useAuthContext } from '@/providers/AuthProviders';
import { extractServerFieldErrors, getFirstServerFieldError, getServerErrorMessage } from '@/lib/serverValidation';

type FieldDraft = {
  key: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  order: number;
  options?: { label: string; value: string }[];
};

const dateFormats = ['yyyy-mm-dd', 'mm/dd/yyyy', 'dd/mm/yyyy', 'dd/mm'] as const;
type DateFormat = (typeof dateFormats)[number];

type Column<T> = {
  key: keyof T;
  header: string;
  cell?: (item: T) => ReactNode;
};

function isOptionField(t: FormFieldType) {
  return t === 'select' || t === 'radio' || t === 'checkbox';
}

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

function slugifyValue(label: string, fallback: string) {
  const v = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return v || fallback;
}

function ensureOptions(f: FieldDraft): FieldDraft {
  if (!isOptionField(f.type)) return { ...f, options: undefined };

  const existing = Array.isArray(f.options) ? f.options : [];
  if (existing.length > 0) return { ...f, options: existing };

  // default starter options
  return {
    ...f,
    options: [
      { label: 'Option 1', value: 'option-1' },
      { label: 'Option 2', value: 'option-2' },
    ],
  };
}

type FormPreset = {
  key: string;
  title: string;
  description: string;
  slug: string;
  submissionTarget: FormSettings['submissionTarget'];
  submissionDepartment?: string;
  responseEmailSubject?: string;
  responseEmailTemplateKey?: string;
  introTitle?: string;
  introSubtitle?: string;
  fields: FieldDraft[];
};

const formPresets: FormPreset[] = [
  {
    key: 'workforce',
    title: 'Workforce Application',
    description: 'Volunteer workforce registration form.',
    slug: 'workforce-registration',
    submissionTarget: 'workforce',
    responseEmailSubject: 'Welcome to the Workforce',
    responseEmailTemplateKey: 'welcome-workforce',
    introTitle: 'Join the Workforce',
    introSubtitle: 'Serve with us and make an impact.',
    fields: [
      { key: 'firstName', label: 'First Name', type: 'text', required: true, order: 1 },
      { key: 'lastName', label: 'Last Name', type: 'text', required: true, order: 2 },
      { key: 'email', label: 'Email', type: 'email', required: true, order: 3 },
      { key: 'phone', label: 'Phone', type: 'tel', required: true, order: 4 },
      { key: 'department', label: 'Department / Unit', type: 'text', required: true, order: 5 },
      { key: 'birthday', label: 'Birthday (DD/MM)', type: 'text', required: false, order: 6 },
      { key: 'notes', label: 'Notes', type: 'textarea', required: false, order: 7 },
    ],
  },
  {
    key: 'member',
    title: 'Membership Registration',
    description: 'New members registration form.',
    slug: 'membership-registration',
    submissionTarget: 'member',
    responseEmailSubject: 'Welcome to Wisdom House Church',
    responseEmailTemplateKey: 'welcome-member',
    introTitle: 'Become a Member',
    introSubtitle: 'We are excited to welcome you.',
    fields: [
      { key: 'firstName', label: 'First Name', type: 'text', required: true, order: 1 },
      { key: 'lastName', label: 'Last Name', type: 'text', required: true, order: 2 },
      { key: 'email', label: 'Email', type: 'email', required: true, order: 3 },
      { key: 'phone', label: 'Phone', type: 'tel', required: false, order: 4 },
      { key: 'birthday', label: 'Birthday (DD/MM)', type: 'text', required: false, order: 5 },
      { key: 'notes', label: 'Notes', type: 'textarea', required: false, order: 6 },
    ],
  },
  {
    key: 'leadership',
    title: 'Leadership Application',
    description: 'Leadership team application form.',
    slug: 'leadership-application',
    submissionTarget: 'workforce',
    submissionDepartment: 'Leadership',
    responseEmailSubject: 'Leadership Application Received',
    responseEmailTemplateKey: 'welcome-leadership',
    introTitle: 'Leadership Application',
    introSubtitle: 'Thank you for your interest in serving in leadership.',
    fields: [
      { key: 'firstName', label: 'First Name', type: 'text', required: true, order: 1 },
      { key: 'lastName', label: 'Last Name', type: 'text', required: true, order: 2 },
      { key: 'email', label: 'Email', type: 'email', required: true, order: 3 },
      { key: 'phone', label: 'Phone', type: 'tel', required: true, order: 4 },
      { key: 'birthday', label: 'Birthday (DD/MM)', type: 'text', required: false, order: 5 },
      { key: 'notes', label: 'Why leadership?', type: 'textarea', required: false, order: 6 },
    ],
  },
];

export default withAuth(function FormsPage() {
  const router = useRouter();
  const auth = useAuthContext();

  const [forms, setForms] = useState<AdminForm[]>([]);
  const [loading, setLoading] = useState(true);

  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [deleteTarget, setDeleteTarget] = useState<AdminForm | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [formCounts, setFormCounts] = useState<Record<string, number>>({});
  const [formStats, setFormStats] = useState<FormStatsResponse | null>(null);

  // Builder state
  const [showBuilder, setShowBuilder] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [slug, setSlug] = useState('');
  const [publishedSlug, setPublishedSlug] = useState<string | null>(null);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [events, setEvents] = useState<EventData[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventId, setEventId] = useState('');
  const [capacity, setCapacity] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  const [introTitle, setIntroTitle] = useState('Event Registration');
  const [introSubtitle, setIntroSubtitle] = useState('Secure your spot by registering below.');
  const [introBullets, setIntroBullets] = useState('Smooth check-in\nEngaging sessions\nFriendly community');
  const [introBulletSubs, setIntroBulletSubs] = useState('Arrive early for badges\nShort, powerful sessions\nMeet friendly stewards');
  const [layoutMode, setLayoutMode] = useState<'split' | 'stack'>('split');
  const [dateFormat, setDateFormat] = useState<DateFormat>('yyyy-mm-dd');

  const footerText = 'Powered by Wisdom House Registration';
  const footerBg = '#f5c400';
  const footerTextColor = '#111827';

  const submitButtonText = 'Submit Registration';
  const submitButtonBg = '#f59e0b';
  const submitButtonTextColor = '#111827';
  const submitButtonIcon: FormSettings['submitButtonIcon'] = 'check';

  const [formHeaderNote, setFormHeaderNote] = useState('Please ensure details are accurate before submitting.');
  const [responseEmailEnabled, setResponseEmailEnabled] = useState(true);
  const [responseEmailTemplateKey, setResponseEmailTemplateKey] = useState('');
  const [responseEmailTemplateId, setResponseEmailTemplateId] = useState('');
  const [responseEmailSubject, setResponseEmailSubject] = useState('');
  const [submissionTarget, setSubmissionTarget] = useState<FormSettings['submissionTarget'] | ''>('');
  const [submissionDepartment, setSubmissionDepartment] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const clearFieldError = (key: string) =>
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });

  const toIso = (value: string) => {
    if (!value) return undefined;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return undefined;
    return d.toISOString();
  };

  const [fields, setFields] = useState<FieldDraft[]>([
    { key: 'full_name', label: 'Full Name', type: 'text', required: true, order: 1 },
    { key: 'email', label: 'Email', type: 'email', required: true, order: 2 },
  ]);

  const authBlocked = useMemo(
    () => !auth.isInitialized || auth.isLoading,
    [auth.isInitialized, auth.isLoading]
  );

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [formsResult, statsResult] = await Promise.allSettled([
        apiClient.getAdminForms({ page, limit }),
        apiClient.getFormStats(),
      ]);

      if (formsResult.status === 'fulfilled') {
        const res = formsResult.value;
        setForms(Array.isArray(res.data) ? res.data : []);
        setTotal(typeof res.total === 'number' ? res.total : 0);
      } else {
        console.error(formsResult.reason);
        setForms([]);
        setTotal(0);
      }

      if (statsResult.status === 'fulfilled') {
        setFormStats(statsResult.value);
        const map: Record<string, number> = {};
        statsResult.value.perForm?.forEach((row) => {
          map[row.formId] = row.count;
        });
        setFormCounts(map);
      } else {
        console.warn('Form stats unavailable:', statsResult.reason);
        setFormCounts({});
        setFormStats(null);
      }
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Failed to load forms';
      toast.error(message);
      setForms([]);
      setTotal(0);
      setFormCounts({});
      setFormStats(null);
    } finally {
      setLoading(false);
    }
  }, [page, limit]);

  useEffect(() => {
    if (authBlocked) return;
    load();
  }, [authBlocked, load]);

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

  const applyPreset = (preset: FormPreset) => {
    setTitle(preset.title);
    setDescription(preset.description);
    setSlug(preset.slug);
    setEventId('');
    setCapacity('');
    setClosesAt('');
    setExpiresAt('');
    setIntroTitle(preset.introTitle || 'Event Registration');
    setIntroSubtitle(preset.introSubtitle || 'Secure your spot by registering below.');
    setIntroBullets('Smooth check-in\nEngaging sessions\nFriendly community');
    setIntroBulletSubs('Arrive early for badges\nShort, powerful sessions\nMeet friendly stewards');
    setLayoutMode('split');
    setDateFormat('dd/mm');
    setFormHeaderNote('Please ensure details are accurate before submitting.');
    setResponseEmailEnabled(true);
    setResponseEmailTemplateKey(preset.responseEmailTemplateKey || '');
    setResponseEmailTemplateId('');
    setResponseEmailSubject(preset.responseEmailSubject || '');
    setSubmissionTarget(preset.submissionTarget || '');
    setSubmissionDepartment(preset.submissionDepartment || '');
    setFields(preset.fields);
    setPublishedSlug(null);
    setPublishedUrl(null);
    setShowBuilder(true);
  };

  const requestDelete = (form: AdminForm) => {
    setDeleteTarget(form);
  };

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await apiClient.deleteAdminForm(deleteTarget.id);
      toast.success('Form deleted');
      setDeleteTarget(null);
      await load();
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Failed to delete form';
      toast.error(message);
    } finally {
      setDeleteLoading(false);
    }
  }, [deleteTarget, load]);

  // ---------- Field builder actions ----------
  const addField = () => {
    const order = fields.length + 1;
    setFields((prev) => [
      ...prev,
      { key: `field_${order}`, label: 'New field', type: 'text', required: false, order },
    ]);
  };

  const updateField = (index: number, updates: Partial<FieldDraft>) => {
    setFields((prev) =>
      prev.map((f, i) => {
        if (i !== index) return f;

        const merged: FieldDraft = { ...f, ...updates };

        // if type changed, initialize or clear options accordingly
        if (updates.type) {
          return ensureOptions(merged);
        }

        return merged;
      })
    );
  };

  const removeField = (index: number) => {
    setFields((prev) => prev.filter((_, i) => i !== index).map((f, idx) => ({ ...f, order: idx + 1 })));
  };

  const addOption = (fieldIndex: number) => {
    setFields((prev) =>
      prev.map((f, i) => {
        if (i !== fieldIndex) return f;
        const next = ensureOptions(f);
        const opts = next.options ?? [];
        const n = opts.length + 1;
        return { ...next, options: [...opts, { label: `Option ${n}`, value: `option-${n}` }] };
      })
    );
  };

  const updateOption = (fieldIndex: number, optIndex: number, label: string) => {
    setFields((prev) =>
      prev.map((f, i) => {
        if (i !== fieldIndex) return f;
        const next = ensureOptions(f);
        const opts = (next.options ?? []).map((opt, idx) => {
          if (idx !== optIndex) return opt;
          return { ...opt, label, value: slugifyValue(label, `option-${idx + 1}`) };
        });
        return { ...next, options: opts };
      })
    );
  };

  const removeOption = (fieldIndex: number, optIndex: number) => {
    setFields((prev) =>
      prev.map((f, i) => {
        if (i !== fieldIndex) return f;
        const next = ensureOptions(f);
        const opts = (next.options ?? []).filter((_, idx) => idx !== optIndex);
        return { ...next, options: opts };
      })
    );
  };

  // ---------- Form actions ----------
  const handlePublish = async (form: AdminForm) => {
    try {
      const res = await apiClient.publishAdminForm(form.id);
      toast.success('Form published');

      const origin = window.location.origin;
      const url = res.publicUrl || `${origin}/forms/${res.slug}`;
      await navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard');
      load();
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Failed to publish form';
      toast.error(message);
    }
  };

  const handleCopyLink = useCallback(async (form: AdminForm) => {
    if (!form.slug && !form.publicUrl) {
      toast.error('This form is not published yet');
      return;
    }
    try {
      const origin = window.location.origin;
      const url = form.publicUrl || `${origin}/forms/${form.slug}`;
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    } catch {
      toast.error('Failed to copy link');
    }
  }, []);

  const deletePhrase = deleteTarget
    ? `DELETE ${deleteTarget.title || deleteTarget.id}`
    : 'DELETE';

  const save = async () => {
    setFieldErrors({});
    const normalizedSlug = normalizeSlug(slug || title);

    const payload: CreateFormRequest = {
      title: title.trim(),
      description: description.trim() || undefined,
      slug: normalizedSlug,
      eventId: eventId || undefined,
      fields: fields.map((f, idx) => {
        const base = {
          key: (f.key || `field_${idx + 1}`).trim(),
          label: f.label.trim(),
          type: f.type,
          required: f.required,
          order: idx + 1,
        };

        if (isOptionField(f.type)) {
          const options =
            (f.options ?? [])
              .map((o, i) => ({
                label: (o.label || '').trim(),
                value: slugifyValue(o.label || '', `option-${i + 1}`),
              }))
              .filter((o) => o.label.length > 0);

          return { ...base, options };
        }

        return base;
      }),
      // NOTE: if your backend FormSettings doesn't include these custom fields, move them to `settings.design`
      // or extend your types/backend. I'm leaving your structure as you currently use it.
      settings: {
        capacity: capacity ? Number(capacity) : undefined,
        closesAt: toIso(closesAt),
        expiresAt: toIso(expiresAt),
        successMessage: 'Thanks! Your registration has been received.',
        responseEmailEnabled,
        responseEmailTemplateId: responseEmailTemplateId.trim() || undefined,
        responseEmailTemplateKey: responseEmailTemplateKey.trim() || undefined,
        responseEmailSubject: responseEmailSubject.trim() || undefined,
        submissionTarget: submissionTarget || undefined,
        submissionDepartment: submissionDepartment.trim() || undefined,
        introTitle,
        introSubtitle,
   
        introBullets: introBullets.split('\n').filter(Boolean),
 
        introBulletSubtexts: introBulletSubs.split('\n').filter(Boolean),
  
        layoutMode,
     
        dateFormat,
       
        footerText,
   
        footerBg,
      
        footerTextColor,
        
        submitButtonText,
 
        submitButtonBg,
     
        submitButtonTextColor,
       
        submitButtonIcon,
     
        formHeaderNote,
      },
    };

    try {
      setSaving(true);
      const created = await apiClient.createAdminForm(payload);

      let slugToUse = created.slug || normalizedSlug;
      let urlToUse: string | null = null;
      try {
        const published = await apiClient.publishAdminForm(created.id);
        slugToUse = published?.slug || slugToUse;
        if (published?.publicUrl) {
          urlToUse = published.publicUrl;
        } else if (typeof window !== 'undefined') {
          urlToUse = `${window.location.origin}/forms/${slugToUse}`;
        }
      } catch {
        // publish optional
      }

      setPublishedSlug(slugToUse);
      setPublishedUrl(urlToUse);
      toast.success('Form created and link ready');
      setShowBuilder(false);
      load();
    } catch (err) {
      console.error(err);
      const fieldErrors = extractServerFieldErrors(err);
      if (Object.keys(fieldErrors).length > 0) {
        setFieldErrors(fieldErrors);
        toast.error(getFirstServerFieldError(fieldErrors) || 'Please review the highlighted fields.');
        return;
      }
      const message = getServerErrorMessage(err, 'Failed to create form');
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (form: AdminForm) => {
    router.push(`/dashboard/forms/${form.id}/edit`);
  };

  const columns = useMemo<Column<AdminForm>[]>(
    () => [
      {
        key: 'title' as keyof AdminForm,
        header: 'Title',
        cell: (f: AdminForm) => (
          <div className="space-y-1">
            <div className="font-medium text-secondary-900">{f.title}</div>
            <div className="text-xs text-secondary-500">{f.description ? f.description : 'No description'}</div>
          </div>
        ),
      },
      {
        key: 'isPublished' as keyof AdminForm,
        header: 'Status',
        cell: (f: AdminForm) => (
          <span
            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
              f.isPublished
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-secondary-50 text-secondary-700 border border-secondary-200'
            }`}
          >
            {f.isPublished ? 'Published' : 'Draft'}
          </span>
        ),
      },
      {
        key: 'id' as keyof AdminForm,
        header: 'Registrations',
        cell: (f: AdminForm) => (
          <span className="text-sm text-secondary-700">
            {formCounts[f.id] ?? 0}
          </span>
        ),
      },
      {
        key: 'slug' as keyof AdminForm,
        header: 'Link',
        cell: (f: AdminForm) => (
          <div className="flex items-center gap-2">
            {f.slug || f.publicUrl ? (
              <>
                <span className="text-xs text-secondary-600 truncate max-w-[220px]">
                  {f.publicUrl || `/forms/${f.slug}`}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyLink(f)}
                  className="inline-flex items-center gap-1 rounded-md border border-secondary-200 bg-white px-2 py-1 text-xs text-secondary-700 hover:bg-secondary-50"
                >
                  <LinkIcon className="h-3.5 w-3.5" />
                  Copy
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => handlePublish(f)}
                className="inline-flex items-center gap-1 rounded-md border border-secondary-200 bg-white px-2 py-1 text-xs text-secondary-700 hover:bg-secondary-50"
              >
                Publish
              </button>
            )}
          </div>
        ),
      },
      {
        key: 'updatedAt' as keyof AdminForm,
        header: 'Updated',
        cell: (f: AdminForm) => (
          <span className="text-sm text-secondary-600">{f.updatedAt ? new Date(f.updatedAt).toLocaleString() : '-'}</span>
        ),
      },
    ],
    [handleCopyLink, formCounts]
  );

  if (authBlocked) {
    return (
      <div className="flex min-h-[300px] w-full items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-solid border-primary-600 border-r-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Forms"
        subtitle="Create and publish event registration forms, then attach the link to an event."
        actions={
          showBuilder ? (
            <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
              <Button variant="ghost" onClick={() => setShowBuilder(false)} className="whitespace-nowrap">
                Back to forms
              </Button>
              <Button variant="outline" onClick={load} className="whitespace-nowrap">
                Refresh
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
              <Button variant="outline" onClick={load} className="whitespace-nowrap">
                Refresh
              </Button>
              <Button onClick={() => setShowBuilder(true)} className="whitespace-nowrap">
                <Plus className="h-4 w-4 mr-2" />
                Create Form
              </Button>
            </div>
          )
        }
      />

      {!showBuilder && (
        <Card title="Quick Create">
          <div className="grid gap-4 md:grid-cols-3">
            {formPresets.map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => applyPreset(preset)}
                className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-4 text-left transition hover:border-[var(--color-border-primary)] hover:shadow-sm"
              >
                <div className="text-sm font-semibold text-[var(--color-text-primary)]">{preset.title}</div>
                <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">{preset.description}</p>
                <p className="mt-3 text-xs text-[var(--color-text-secondary)]">
                  Default link:{' '}
                  <span className="font-medium text-[var(--color-text-primary)]">/forms/{preset.slug}</span>
                </p>
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-[var(--color-text-tertiary)]">
            Use these presets to instantly spin up workforce, membership, and leadership registration forms.
          </p>
        </Card>
      )}

      {showBuilder && (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="grid gap-5 md:grid-cols-2">
              <Input
                label="Title *"
                value={title}
                onChange={(e) => {
                  clearFieldError('title');
                  setTitle(e.target.value);
                }}
                placeholder="e.g., Youth Summit Registration"
                error={fieldErrors.title}
              />

              <div className="space-y-2">
                <Input
                  label="Form Link Name *"
                  value={slug}
                  onChange={(e) => {
                    clearFieldError('slug');
                    setSlug(e.target.value);
                  }}
                  onBlur={() => setSlug((current) => normalizeSlug(current))}
                  placeholder="e.g., wpc"
                  error={fieldErrors.slug}
                />
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  Public link preview:{' '}
                  <span className="font-medium text-[var(--color-text-secondary)]">
                    /forms/{normalizeSlug(slug || title || 'your-link')}
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

              <div className="md:col-span-2 rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-4">
                <div className="mb-3">
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">Registration Settings</p>
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    Set capacity and registration window for this form.
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Linked Event</label>
                    <select
                      className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                      value={eventId}
                      onChange={(e) => setEventId(e.target.value)}
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
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    placeholder="e.g., 250"
                  />

                  <Input
                    label="Closes At (optional)"
                    type="datetime-local"
                    value={closesAt}
                    onChange={(e) => setClosesAt(e.target.value)}
                  />

                  <Input
                    label="Expires At (optional)"
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                  />
                </div>
              </div>

              <div className="md:col-span-2 rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-4">
                <div className="mb-3">
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">Submission Routing</p>
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    Route registrations into Workforce or Member records automatically.
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Submission Target</label>
                    <select
                      className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                      value={submissionTarget}
                      onChange={(e) => {
                        clearFieldError('submissionTarget');
                        setSubmissionTarget(e.target.value as FormSettings['submissionTarget']);
                      }}
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
                    value={submissionDepartment}
                    onChange={(e) => {
                      clearFieldError('submissionDepartment');
                      setSubmissionDepartment(e.target.value);
                    }}
                    placeholder="e.g., Hospitality"
                    disabled={submissionTarget !== 'workforce'}
                    error={fieldErrors.submissionDepartment}
                  />
                </div>
              </div>

              <div className="md:col-span-2 rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-4">
                <div className="mb-3">
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">Response Email</p>
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    Send a confirmation email after the form is submitted.
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                  <input
                    type="checkbox"
                    checked={responseEmailEnabled}
                    onChange={(e) => setResponseEmailEnabled(e.target.checked)}
                  />
                  Enable response email
                </label>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <Input
                    label="Email subject"
                    value={responseEmailSubject}
                    onChange={(e) => {
                      clearFieldError('responseEmailSubject');
                      setResponseEmailSubject(e.target.value);
                    }}
                    placeholder="Welcome to Wisdom House Church"
                    disabled={!responseEmailEnabled}
                    error={fieldErrors.responseEmailSubject}
                  />
                  <Input
                    label="Template key"
                    value={responseEmailTemplateKey}
                    onChange={(e) => {
                      clearFieldError('responseEmailTemplateKey');
                      setResponseEmailTemplateKey(e.target.value);
                    }}
                    placeholder="welcome-member"
                    disabled={!responseEmailEnabled}
                    error={fieldErrors.responseEmailTemplateKey}
                  />
                  <Input
                    label="Template ID (optional)"
                    value={responseEmailTemplateId}
                    onChange={(e) => {
                      clearFieldError('responseEmailTemplateId');
                      setResponseEmailTemplateId(e.target.value);
                    }}
                    placeholder="Template UUID"
                    disabled={!responseEmailEnabled}
                    error={fieldErrors.responseEmailTemplateId}
                  />
                </div>
                <p className="mt-3 text-xs text-[var(--color-text-tertiary)]">
                  Template key or ID must match a template saved in the Email Templates registry. Leave blank to use the
                  default confirmation email.
                </p>
              </div>

              <div className="md:col-span-2 grid gap-3 md:grid-cols-3">
                <Input label="Left column title" value={introTitle} onChange={(e) => setIntroTitle(e.target.value)} />
                <Input label="Left column subtitle" value={introSubtitle} onChange={(e) => setIntroSubtitle(e.target.value)} />
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)]">Left column bullets (one per line)</label>
                  <textarea
                    className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm"
                    rows={3}
                    value={introBullets}
                    onChange={(e) => setIntroBullets(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)]">Bullet subtext (matches order)</label>
                  <textarea
                    className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm"
                    rows={3}
                    value={introBulletSubs}
                    onChange={(e) => setIntroBulletSubs(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)]">Form header note</label>
                  <textarea
                    className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm"
                    rows={2}
                    value={formHeaderNote}
                    onChange={(e) => setFormHeaderNote(e.target.value)}
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-[var(--color-text-tertiary)]">Build the form fields below, then create to generate the link.</p>
                  <div className="flex flex-wrap gap-2 sm:flex-nowrap">
                    <select
                      value={layoutMode}
                  onChange={(e) => setLayoutMode(e.target.value === 'split' ? 'split' : 'stack')}
                  className="rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm"
                >
                      <option value="split">Two column layout</option>
                      <option value="stack">Single column layout</option>
                    </select>
                    <select
                      value={dateFormat}
                  onChange={(e) => {
                    const next = e.target.value as DateFormat;
                    if (dateFormats.includes(next)) setDateFormat(next);
                  }}
                  className="rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm"
                >
                      <option value="yyyy-mm-dd">YYYY-MM-DD</option>
                      <option value="mm/dd/yyyy">MM/DD/YYYY</option>
                      <option value="dd/mm/yyyy">DD/MM/YYYY</option>
                      <option value="dd/mm">DD/MM</option>
                    </select>
                    <Button onClick={save} loading={saving} disabled={saving} icon={<Save className="h-4 w-4" />} className="whitespace-nowrap">
                      Create & Publish
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Builder */}
          <Card title="Form Builder">
            <div className="space-y-4">
              {fields.map((field, index) => {
                const optionReadyField = isOptionField(field.type) ? ensureOptions(field) : field;

                return (
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
                          <option value="radio">Radio</option>
                        </select>

                        <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) => updateField(index, { required: e.target.checked })}
                          />
                          Required
                        </label>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeField(index)}
                          icon={<Trash2 className="h-4 w-4" />}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>

                    {/* OPTIONS EDITOR (FIX) */}
                    {isOptionField(field.type) && (
                      <div className="mt-3 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs text-[var(--color-text-tertiary)]">Options (add as many as you want)</p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addOption(index)}
                            className="whitespace-nowrap"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add option
                          </Button>
                        </div>

                        <div className="space-y-2">
                          {(optionReadyField.options ?? []).map((opt, optIdx) => (
                            <div key={optIdx} className="flex items-center gap-2">
                              <input
                                className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm"
                                value={opt.label}
                                onChange={(e) => updateOption(index, optIdx, e.target.value)}
                                placeholder={`Option ${optIdx + 1}`}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => removeOption(index, optIdx)}
                                className="whitespace-nowrap"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>

                        <p className="text-[11px] text-[var(--color-text-tertiary)]">
                          Tip: Values are auto-generated from labels.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}

              <Button variant="outline" onClick={addField} icon={<Plus className="h-4 w-4" />} className="whitespace-nowrap">
                Add Field
              </Button>
            </div>
          </Card>

          {/* Link preview */}
          <Card title="Form Link">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-[var(--color-text-secondary)]">
                {publishedUrl || (publishedSlug ? `/forms/${publishedSlug}` : 'Create & publish to generate link')}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (!publishedSlug && !publishedUrl) {
                    toast.error('Publish first to copy link');
                    return;
                  }
                  if (publishedUrl) {
                    await navigator.clipboard.writeText(publishedUrl);
                  } else if (publishedSlug) {
                    await navigator.clipboard.writeText(`${window.location.origin}/forms/${publishedSlug}`);
                  }
                  toast.success('Link copied');
                }}
                icon={<Copy className="h-4 w-4" />}
                disabled={!publishedSlug && !publishedUrl}
              >
                Copy
              </Button>
            </div>
          </Card>
        </div>
      )}

      <Card className="p-0">
        <DataTable
          data={forms ?? []}
          columns={columns}
          total={total}
          page={page}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={setLimit}
          onEdit={handleEdit}
          onDelete={requestDelete}
          onView={(f: AdminForm) => router.push(`/dashboard/forms/${f.id}/submissions`)}
          isLoading={loading}
        />
      </Card>

      {formStats && (
        <div className="text-xs text-secondary-500">
          Total registrations across all forms: {formStats.totalSubmissions}
        </div>
      )}

      <div className="text-xs text-secondary-500">
        Tip: Click “View” to see registrations for a form.
      </div>

      <VerifyActionModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete Form"
        description="This action permanently removes the form and its configuration."
        confirmText="Delete Form"
        cancelText="Cancel"
        variant="danger"
        loading={deleteLoading}
        verifyText={deletePhrase}
      />
    </div>
  );
}, { requiredRole: 'admin' });
