// src/app/dashboard/forms/page.tsx
'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Plus, Link as LinkIcon, Save, Copy, Trash2 } from 'lucide-react';

import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { DataTable } from '@/components/DateTable';
import { PageHeader } from '@/layouts';
import { Input } from '@/ui/input';
import { VerifyActionModal } from '@/ui/VerifyActionModal';
import { AlertModal } from '@/ui/AlertModal';

import { apiClient, mapValidationErrors } from '@/lib/api';
import type {
  AdminForm,
  CreateFormRequest,
  EventData,
  FormFieldType,
  FormSettings,
  FormStatsResponse,
  FormStatus,
  FormSubmission,
} from '@/lib/types';
import { buildPublicFormUrl } from '@/lib/utils';
import { createFormSchema } from '@/lib/validation/forms';

import { withAuth } from '@/providers/withAuth';
import { useAuthContext } from '@/providers/AuthProviders';
import {
  extractServerFieldErrors,
  getFirstServerFieldError,
  getServerErrorMessage,
} from '@/lib/serverValidation';

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

const MAX_BANNER_MB = 5;
const MAX_BANNER_BYTES = MAX_BANNER_MB * 1024 * 1024;
const ACCEPTED_BANNER_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

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

function normalizeFieldKey(value: string, fallback: string) {
  const v = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '');
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

function normalizeFormStatus(status?: string): FormStatus | undefined {
  if (status === 'draft' || status === 'published' || status === 'invalid') return status;
  return undefined;
}

function isExpiredForm(form: AdminForm): boolean {
  if (form.status === 'invalid') return true;
  const closesAt = form.settings?.closesAt;
  if (!closesAt) return false;
  const date = new Date(closesAt);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() < Date.now();
}

const buildPublicUrl = buildPublicFormUrl;

function formatDateTime(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatRemaining(value?: string): string {
  if (!value) return 'No expiry';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No expiry';
  const diff = date.getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  if (days > 0) return `${days}d ${remHours}h left`;
  return `${remHours}h left`;
}

function getFormStatus(form: AdminForm): 'draft' | 'published' | 'invalid' {
  if (form.status === 'invalid') return 'invalid';
  if (isExpiredForm(form)) return 'invalid';
  if (form.isPublished || form.status === 'published') return 'published';
  return 'draft';
}

export default withAuth(function FormsPage() {
  const router = useRouter();
  const auth = useAuthContext();

  const [activeTab, setActiveTab] = useState<'forms' | 'submissions'>('forms');
  const [forms, setForms] = useState<AdminForm[]>([]);
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);

  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [deleteTarget, setDeleteTarget] = useState<AdminForm | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [formCounts, setFormCounts] = useState<Record<string, number>>({});
  const [formStats, setFormStats] = useState<FormStatsResponse | null>(null);
  const [publishedPublicUrl, setPublishedPublicUrl] = useState<string | null>(null);
  const [selectedFormId, setSelectedFormId] = useState('');
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [submissionsTotal, setSubmissionsTotal] = useState(0);
  const [submissionsPage, setSubmissionsPage] = useState(1);
  const [submissionsLimit, setSubmissionsLimit] = useState(10);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');
  const [liveUpdates, setLiveUpdates] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  // ✅ PDF export loading state
  const [exportingPdf, setExportingPdf] = useState(false);

  // Builder state
  const [showBuilder, setShowBuilder] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [slug, setSlug] = useState('');
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
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [successTitle, setSuccessTitle] = useState('');
  const [successSubtitle, setSuccessSubtitle] = useState('');
  const [successMessage, setSuccessMessage] = useState('We would love to see you.');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [removeFieldIndex, setRemoveFieldIndex] = useState<number | null>(null);

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

  const [fields, setFields] = useState<FieldDraft[]>([
    { key: 'full_name', label: 'Full Name', type: 'text', required: true, order: 1 },
    { key: 'email', label: 'Email', type: 'email', required: true, order: 2 },
  ]);

  const authBlocked = useMemo(
    () => !auth.isInitialized || auth.isLoading,
    [auth.isInitialized, auth.isLoading]
  );

  const resolvedPublicUrl = useMemo(() => {
    if (publishedPublicUrl) return publishedPublicUrl;
    const firstPublished = forms.find((f) => f.publicUrl || (f.slug && (f.isPublished || f.status === 'published')));
    if (!firstPublished) return null;
    return buildPublicUrl(firstPublished.slug, firstPublished.publicUrl);
  }, [publishedPublicUrl, forms]);

  const perFormStats = useMemo(() => formStats?.perForm ?? [], [formStats]);
  const maxPerForm = useMemo(() => {
    const counts = perFormStats.map((item) => item.count);
    return counts.length > 0 ? Math.max(...counts) : 1;
  }, [perFormStats]);

  const eventMap = useMemo(() => {
    return events.reduce((acc, event) => {
      acc[event.id] = event.title;
      return acc;
    }, {} as Record<string, string>);
  }, [events]);

  const eventCounts = useMemo(() => {
    const bucket = new Map<string, { eventId: string; name: string; count: number }>();
    perFormStats.forEach((stat) => {
      const form = forms.find((f) => f.id === stat.formId);
      const eventId = form?.eventId || 'no_event';
      const name = eventId === 'no_event' ? 'No event attached' : eventMap[eventId] || eventId;
      const current = bucket.get(eventId) || { eventId, name, count: 0 };
      current.count += stat.count;
      bucket.set(eventId, current);
    });
    return Array.from(bucket.values()).sort((a, b) => b.count - a.count);
  }, [perFormStats, forms, eventMap]);

  const maxEventCount = useMemo(() => {
    const counts = eventCounts.map((item) => item.count);
    return counts.length > 0 ? Math.max(...counts) : 1;
  }, [eventCounts]);

  const trendSource = useMemo(() => {
    const source = formStats?.recent ?? [];
    if (!selectedFormId) return source;
    return source.filter((item) => item.formId === selectedFormId);
  }, [formStats, selectedFormId]);

  const trendData = useMemo(() => {
    const days = 7;
    const today = new Date();
    const buckets = Array.from({ length: days }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (days - 1 - index));
      const label = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      return { label, dateKey: date.toDateString(), count: 0 };
    });

    trendSource.forEach((item) => {
      const created = new Date(item.createdAt);
      if (Number.isNaN(created.getTime())) return;
      const key = created.toDateString();
      const bucket = buckets.find((b) => b.dateKey === key);
      if (bucket) bucket.count += 1;
    });

    return buckets;
  }, [trendSource]);

  const maxTrendCount = useMemo(() => {
    const counts = trendData.map((item) => item.count);
    return counts.length > 0 ? Math.max(...counts) : 1;
  }, [trendData]);

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
    if (selectedFormId) return;
    if (forms.length > 0) setSelectedFormId(forms[0].id);
  }, [forms, selectedFormId]);

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

  const loadSubmissions = useCallback(async () => {
    if (!selectedFormId) {
      setSubmissions([]);
      setSubmissionsTotal(0);
      return;
    }
    try {
      setSubmissionsLoading(true);
      const res = await apiClient.getFormSubmissions(selectedFormId, {
        page: submissionsPage,
        limit: submissionsLimit,
      });
      setSubmissions(Array.isArray(res.data) ? res.data : []);
      setSubmissionsTotal(typeof res.total === 'number' ? res.total : 0);
      setLastUpdatedAt(new Date().toISOString());
    } catch (err) {
      console.error(err);
      toast.error('Failed to load submissions');
      setSubmissions([]);
      setSubmissionsTotal(0);
    } finally {
      setSubmissionsLoading(false);
    }
  }, [selectedFormId, submissionsPage, submissionsLimit]);

  useEffect(() => {
    if (activeTab !== 'submissions') return;
    loadSubmissions();
  }, [activeTab, loadSubmissions]);

  useEffect(() => {
    if (activeTab !== 'submissions') return;
    if (!liveUpdates) return;
    const interval = setInterval(() => {
      load();
      loadSubmissions();
    }, 15000);
    return () => clearInterval(interval);
  }, [activeTab, liveUpdates, load, loadSubmissions]);

  const filteredSubmissions = useMemo(() => {
    const term = filterText.trim().toLowerCase();
    const start = filterStart ? new Date(filterStart) : null;
    const end = filterEnd ? new Date(filterEnd) : null;

    if (start && Number.isNaN(start.getTime())) return submissions;
    if (end && Number.isNaN(end.getTime())) return submissions;

    return submissions.filter((submission) => {
      const haystack = [
        submission.name,
        submission.email,
        submission.contactNumber,
        submission.contactAddress,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (term && !haystack.includes(term)) return false;

      if (start || end) {
        const created = new Date(submission.createdAt);
        if (Number.isNaN(created.getTime())) return false;
        if (start && created < start) return false;
        if (end) {
          const endOfDay = new Date(end);
          endOfDay.setHours(23, 59, 59, 999);
          if (created > endOfDay) return false;
        }
      }

      return true;
    });
  }, [submissions, filterText, filterStart, filterEnd]);

  const filteredTotal = useMemo(() => {
    const hasFilters = filterText.trim() || filterStart || filterEnd;
    return hasFilters ? filteredSubmissions.length : submissionsTotal;
  }, [filterText, filterStart, filterEnd, filteredSubmissions.length, submissionsTotal]);

  // ✅ REPLACED: export CSV -> export PDF (server-generated)
  const exportSubmissions = useCallback(async () => {
    if (!selectedFormId) {
      toast.error('Select a form first');
      return;
    }
    if (filteredSubmissions.length === 0) {
      toast.error('No submissions to export');
      return;
    }

    try {
      setExportingPdf(true);

      // Env-aware base URL normalization:
      const rawBase =
        (process.env.NEXT_PUBLIC_API_URL ||
          (process.env as unknown as { NEXT_PUBLIC_API_BASE_URL?: string }).NEXT_PUBLIC_API_BASE_URL ||
          '').trim();

      let base = rawBase.replace(/\/+$/, '');
      if (!base) base = 'http://localhost:8080';

      // If mistakenly set to https://domain.com/api/v1, normalize to origin
      if (base.endsWith('/api/v1')) base = base.slice(0, -'/api/v1'.length);

      // Optional query params (backend may ignore, safe to send)
      const params = new URLSearchParams();
      if (filterText.trim()) params.set('q', filterText.trim());
      if (filterStart.trim()) params.set('from', filterStart.trim());
      if (filterEnd.trim()) params.set('to', filterEnd.trim());

      const url = `${base}/api/v1/admin/forms/${selectedFormId}/submissions/export.pdf${
        params.toString() ? `?${params.toString()}` : ''
      }`;

      const res = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/pdf' },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Export failed (${res.status})`);
      }

      const blob = await res.blob();
      const dlUrl = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = dlUrl;
      a.download = `form-submissions-${selectedFormId}-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      URL.revokeObjectURL(dlUrl);

      toast.success('PDF exported. Password is your login email.');
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Failed to export PDF');
    } finally {
      setExportingPdf(false);
    }
  }, [filteredSubmissions.length, selectedFormId, filterText, filterStart, filterEnd]);

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

  const requestRemoveField = (index: number) => {
    setRemoveFieldIndex(index);
  };

  const confirmRemoveField = () => {
    if (removeFieldIndex === null) return;
    setFields((prev) =>
      prev.filter((_, i) => i !== removeFieldIndex).map((f, idx) => ({ ...f, order: idx + 1 }))
    );
    setRemoveFieldIndex(null);
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
  const handlePublish = useCallback(async (form: AdminForm) => {
    try {
      const res = await apiClient.publishAdminForm(form.id);
      toast.success('Form published');

      let nextSlug = res?.slug || form.slug || '';
      if (!nextSlug && form.title) nextSlug = normalizeSlug(form.title);
      const nextPublicUrl = buildPublicUrl(nextSlug, res?.publicUrl || form.publicUrl || undefined);
      if (nextPublicUrl) setPublishedPublicUrl(nextPublicUrl);

      setForms((prev) =>
        prev.map((item) =>
          item.id === form.id
            ? {
                ...item,
                slug: nextSlug || item.slug,
                publicUrl: nextPublicUrl || item.publicUrl,
                isPublished: true,
                status: normalizeFormStatus(res?.status) ?? 'published',
                publishedAt: res?.publishedAt || item.publishedAt,
              }
            : item
        )
      );

      if (nextPublicUrl) {
        await navigator.clipboard.writeText(nextPublicUrl);
      }
      toast.success('Link copied to clipboard');
      load();
    } catch (err) {
      console.error(err);
      const message = getServerErrorMessage(err, 'Failed to publish form');
      toast.error(message);
    }
  }, [load]);

  const handleCopyLink = useCallback(async (form: AdminForm) => {
    const status = getFormStatus(form);
    if (status === 'invalid') {
      toast.error('This form has expired and is no longer available.');
      return;
    }
    if (status !== 'published') {
      toast.error('This form is not published yet');
      return;
    }
    const link = buildPublicUrl(form.slug, form.publicUrl);
    if (!link) {
      toast.error('This form is not published yet');
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Link copied');
    } catch {
      toast.error('Failed to copy link');
    }
  }, []);

  const deletePhrase = deleteTarget
    ? `DELETE ${deleteTarget.title || deleteTarget.id}`
    : 'DELETE';

  const pendingField = removeFieldIndex !== null ? fields[removeFieldIndex] : null;

  const save = async () => {
    setFieldErrors({});
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      setFieldErrors((prev) => ({ ...prev, title: 'Title is required' }));
      toast.error('Title is required');
      return;
    }
    const normalizedSlug = normalizeSlug(slug || normalizedTitle);

    const payload: CreateFormRequest = {
      title: normalizedTitle,
      description: description.trim() || undefined,
      slug: normalizedSlug,
      eventId: eventId || undefined,
      fields: fields.map((f, idx) => {
        const base = {
          key: normalizeFieldKey(f.key || `field_${idx + 1}`, `field_${idx + 1}`),
          label: f.label.trim() || `Field ${idx + 1}`,
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

          return { ...base, options: options.length > 0 ? options : undefined };
        }

        return base;
      }),
      // NOTE: if your backend FormSettings doesn't include these custom fields, move them to `settings.design`
      // or extend your types/backend. I'm leaving your structure as you currently use it.
      settings: {
        capacity: capacity ? Number(capacity) : undefined,
        closesAt: toIso(closesAt),
        expiresAt: toIso(expiresAt),
        successTitle: successTitle.trim() || undefined,
        successSubtitle: successSubtitle.trim() || undefined,
        successMessage: successMessage.trim() || undefined,
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
        design: coverImageUrl.trim()
          ? { coverImageUrl: coverImageUrl.trim() }
          : undefined,
      },
    };

    const parsed = createFormSchema.safeParse(payload);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      toast.error(issue?.message || 'Please fix validation errors before saving.');
      return;
    }

    try {
      setSaving(true);
      let created = await apiClient.createAdminForm(payload);

      if (bannerFile) {
        try {
          created = await apiClient.uploadFormBanner(created.id, bannerFile);
        } catch (uploadErr) {
          console.error('Banner upload failed:', uploadErr);
          toast.error('Form saved, but banner upload failed.');
        }
      }

      let slugToUse = created.slug || normalizedSlug;
      let publicUrlToUse: string | null = created.publicUrl
        ? buildPublicUrl(created.slug, created.publicUrl)
        : buildPublicUrl(slugToUse);
      let publishedOk = false;
      let publishError: string | null = null;
      try {
        const published = await apiClient.publishAdminForm(created.id);
        publishedOk = true;
        slugToUse = published?.slug || slugToUse;
        publicUrlToUse = buildPublicUrl(slugToUse, published?.publicUrl || publicUrlToUse || undefined);
      } catch (err) {
        publishedOk = false;
        publishError = getServerErrorMessage(err, 'Publish failed. Form saved as draft.');
      }

      setPublishedPublicUrl(publishedOk ? publicUrlToUse : null);
      if (publishedOk) {
        toast.success('Form created and link ready');
      } else {
        toast.success('Form created');
        toast.error(publishError || 'Publish the form to get a live link.');
      }
      setBannerFile(null);
      setBannerPreview(null);
      setShowBuilder(false);
      load();
    } catch (err) {
      console.error(err);
      const validationMap = mapValidationErrors(err);
      if (validationMap && Object.keys(validationMap).length > 0) {
        setFieldErrors(validationMap);
        toast.error(getFirstServerFieldError(validationMap) || 'Please review the highlighted fields.');
        return;
      }
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

 const columns = useMemo<Column<AdminForm>[]>(() => [
  {
    key: 'title' as keyof AdminForm,
    header: 'Title',
    cell: (f: AdminForm) => (
      <div className="font-medium text-secondary-900">{f.title}</div>
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
    cell: (f: AdminForm) => {
      const status = getFormStatus(f);
      return (
        <div className="flex items-center gap-2">
          {status === 'invalid' ? (
            <span className="text-xs text-red-500">Expired</span>
          ) : status !== 'published' ? (
            <button
              type="button"
              onClick={() => handlePublish(f)}
              className="inline-flex items-center gap-1 rounded-md border border-secondary-200 bg-white px-2 py-1 text-xs text-secondary-700 hover:bg-secondary-50"
            >
              Publish
            </button>
          ) : (
            <>
              <span className="text-xs text-secondary-600 truncate max-w-[220px]">
                {buildPublicUrl(f.slug, f.publicUrl) || `/forms/${f.slug}`}
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
          )}
        </div>
      );
    },
  },
  {
    key: 'publishedAt' as keyof AdminForm,
    header: 'Published',
    cell: (f: AdminForm) => (
      <span className="text-xs text-secondary-600">{formatDateTime(f.publishedAt)}</span>
    ),
  },
  {
    key: 'settings' as keyof AdminForm,
    header: 'Active Until',
    cell: (f: AdminForm) => (
      <div className="text-xs text-secondary-600">
        <div>{formatDateTime(f.settings?.closesAt)}</div>
        <div className="text-[0.7rem] text-secondary-400">{formatRemaining(f.settings?.closesAt)}</div>
      </div>
    ),
  },
  {
    key: 'updatedAt' as keyof AdminForm,
    header: 'Updated',
    cell: (f: AdminForm) => (
      <span className="text-sm text-secondary-600">
        {f.updatedAt ? new Date(f.updatedAt).toLocaleString() : '-'}
      </span>
    ),
  },
], [handleCopyLink, handlePublish, formCounts]);

  const submissionColumns = useMemo<Column<FormSubmission>[]>(
    () => [
      {
        key: 'name' as keyof FormSubmission,
        header: 'Name',
        cell: (item: FormSubmission) => (
          <div className="space-y-1">
            <div className="text-sm font-semibold text-secondary-900">
              {item.name || item.email || 'Anonymous'}
            </div>
            <div className="text-xs text-secondary-500">{item.email || 'No email'}</div>
          </div>
        ),
      },
      {
        key: 'contactNumber' as keyof FormSubmission,
        header: 'Contact',
        cell: (item: FormSubmission) => (
          <div className="text-xs text-secondary-600">
            {item.contactNumber || item.contactAddress || '—'}
          </div>
        ),
      },
      {
        key: 'values' as keyof FormSubmission,
        header: 'Responses',
        cell: (item: FormSubmission) => (
          <span className="text-xs text-secondary-600">
            {Object.keys(item.values || {}).length} fields
          </span>
        ),
      },
      {
        key: 'createdAt' as keyof FormSubmission,
        header: 'Submitted',
        cell: (item: FormSubmission) => (
          <span className="text-xs text-secondary-600">{formatDateTime(item.createdAt)}</span>
        ),
      },
    ],
    []
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

      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={activeTab === 'forms' ? 'secondary' : 'ghost'}
            onClick={() => setActiveTab('forms')}
          >
            Forms
          </Button>
          <Button
            variant={activeTab === 'submissions' ? 'secondary' : 'ghost'}
            onClick={() => setActiveTab('submissions')}
          >
            Submissions
          </Button>
          <div className="ml-auto text-xs text-[var(--color-text-tertiary)]">
            Last updated: {lastUpdatedAt ? formatDateTime(lastUpdatedAt) : '—'}
          </div>
        </div>
      </Card>

      {activeTab === 'submissions' && (
        <>
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <Card title="Registration Insights">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
                  <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">Total registrations</p>
                  <p className="mt-2 text-2xl font-semibold text-[var(--color-text-primary)]">
                    {formStats?.totalSubmissions ?? 0}
                  </p>
                </div>
                <div className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
                  <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">Active forms</p>
                  <p className="mt-2 text-2xl font-semibold text-[var(--color-text-primary)]">
                    {forms.filter((f) => getFormStatus(f) === 'published').length}
                  </p>
                </div>
                <div className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
                  <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">Invalid/expired</p>
                  <p className="mt-2 text-2xl font-semibold text-[var(--color-text-primary)]">
                    {forms.filter((f) => getFormStatus(f) === 'invalid').length}
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">Registrations per form</p>
                {perFormStats.length === 0 ? (
                  <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">No registrations yet.</p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {perFormStats.slice(0, 6).map((item) => (
                      <div key={item.formId} className="space-y-1">
                        <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
                          <span className="font-medium">{item.formTitle}</span>
                          <span>{item.count}</span>
                        </div>
                        <div className="h-2 rounded-full bg-[var(--color-background-tertiary)]">
                          <div
                            className="h-2 rounded-full bg-[var(--color-accent-primary)]"
                            style={{ width: `${Math.max(5, (item.count / maxPerForm) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-6">
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">Registration trend (last 7 days)</p>
                {trendData.length === 0 ? (
                  <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">No submissions yet.</p>
                ) : (
                  <div className="mt-3 grid grid-cols-7 gap-2">
                    {trendData.map((item) => (
                      <div key={item.label} className="flex flex-col items-center gap-2">
                        <div className="flex h-24 w-full items-end rounded-[var(--radius-card)] bg-[var(--color-background-tertiary)] p-1">
                          <div
                            className="w-full rounded-[var(--radius-card)] bg-[var(--color-accent-primary)]"
                            style={{
                              height: `${Math.max(6, (item.count / maxTrendCount) * 100)}%`,
                            }}
                          />
                        </div>
                        <div className="text-[0.7rem] text-[var(--color-text-tertiary)]">{item.label}</div>
                        <div className="text-[0.7rem] font-semibold text-[var(--color-text-secondary)]">{item.count}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-6">
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">Event registrations</p>
                {eventCounts.length === 0 ? (
                  <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">No event registrations yet.</p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {eventCounts.slice(0, 6).map((item) => (
                      <div key={item.eventId} className="space-y-1">
                        <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
                          <span className="font-medium">{item.name}</span>
                          <span>{item.count}</span>
                        </div>
                        <div className="h-2 rounded-full bg-[var(--color-background-tertiary)]">
                          <div
                            className="h-2 rounded-full bg-[var(--color-accent-primary)]"
                            style={{ width: `${Math.max(5, (item.count / maxEventCount) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            <Card title="Recent Submissions">
              {formStats?.recent?.length ? (
                <div className="space-y-3">
                  {formStats.recent.slice(0, 6).map((submission) => (
                    <div
                      key={submission.id}
                      className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-3"
                    >
                      <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {submission.name || submission.email || 'Anonymous'}
                      </p>
                      <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">{submission.formTitle}</p>
                      <p className="mt-2 text-[0.7rem] text-[var(--color-text-tertiary)]">
                        {formatDateTime(submission.createdAt)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--color-text-tertiary)]">No submissions yet.</p>
              )}
            </Card>
          </div>

          <Card title="Submission Explorer">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[220px]">
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Form</label>
                <select
                  className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm"
                  value={selectedFormId}
                  onChange={(e) => {
                    setSelectedFormId(e.target.value);
                    setSubmissionsPage(1);
                  }}
                >
                  <option value="">Select a form</option>
                  {forms.map((form) => (
                    <option key={form.id} value={form.id}>
                      {form.title}
                    </option>
                  ))}
                </select>
              </div>

              <Input
                label="Search"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Name, email, phone..."
              />

              <Input
                label="From"
                type="date"
                value={filterStart}
                onChange={(e) => setFilterStart(e.target.value)}
              />

              <Input
                label="To"
                type="date"
                value={filterEnd}
                onChange={(e) => setFilterEnd(e.target.value)}
              />

              <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                <input
                  type="checkbox"
                  checked={liveUpdates}
                  onChange={(e) => setLiveUpdates(e.target.checked)}
                />
                Live updates
              </label>

              <Button variant="outline" onClick={loadSubmissions} className="whitespace-nowrap">
                Refresh
              </Button>

              {/* ✅ CHANGED: Export CSV -> Export PDF (server-generated) */}
              <Button
                variant="outline"
                onClick={exportSubmissions}
                loading={exportingPdf}
                disabled={exportingPdf || filteredSubmissions.length === 0 || !selectedFormId}
                className="whitespace-nowrap"
              >
                Export PDF
              </Button>
            </div>

            {!selectedFormId ? (
              <p className="mt-4 text-sm text-[var(--color-text-tertiary)]">
                Select a form to view registrations.
              </p>
            ) : (
              <div className="mt-4">
                <DataTable
                  data={filteredSubmissions}
                  columns={submissionColumns}
                  total={filteredTotal}
                  page={submissionsPage}
                  limit={submissionsLimit}
                  onPageChange={setSubmissionsPage}
                  onLimitChange={(next) => {
                    setSubmissionsLimit(next);
                    setSubmissionsPage(1);
                  }}
                  isLoading={submissionsLoading}
                />
              </div>
            )}
          </Card>
        </>
      )}

      {activeTab === 'forms' && showBuilder && (
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

              <div className="space-y-2">
                <Input
                  label="Publish Until (optional)"
                  type="datetime-local"
                  value={closesAt}
                  onChange={(e) => setClosesAt(e.target.value)}
                  helperText="Forms auto-expire after this time."
                />
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

              <div className="md:col-span-2 grid gap-3 md:grid-cols-2">
                <Input
                  label="Header image URL (optional)"
                  value={coverImageUrl}
                  onChange={(e) => setCoverImageUrl(e.target.value)}
                  placeholder="https://..."
                  helperText="Shown at the top of the public form."
                />
                <Input
                  label="Or upload header image"
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleBannerFile(e.target.files?.[0])}
                  helperText="Uploads to S3 and replaces the URL above."
                />
                <Input
                  label="Success modal title (optional)"
                  value={successTitle}
                  onChange={(e) => setSuccessTitle(e.target.value)}
                  placeholder="Thank you for registering"
                  helperText="Supports tokens like {{formTitle}} and {{name}}."
                />
                <Input
                  label="Success modal subtitle (optional)"
                  value={successSubtitle}
                  onChange={(e) => setSuccessSubtitle(e.target.value)}
                  placeholder="for {{formTitle}}"
                  helperText="Use {{eventDate}} or {{eventLocation}} if relevant."
                />
                <div className="space-y-2 md:col-span-2">
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)]">Success modal message</label>
                  <textarea
                    className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm"
                    rows={2}
                    value={successMessage}
                    onChange={(e) => setSuccessMessage(e.target.value)}
                    placeholder="We would love to see you."
                  />
                </div>
                {(bannerPreview || coverImageUrl.trim()) && (
                  <div className="md:col-span-2">
                    <Image
                      src={bannerPreview || coverImageUrl.trim()}
                      alt="Banner preview"
                      width={1200}
                      height={400}
                      className="w-full max-h-64 rounded-[var(--radius-card)] object-cover border border-[var(--color-border-secondary)]"
                      unoptimized
                    />
                  </div>
                )}
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
                {resolvedPublicUrl || 'Create & publish to generate link'}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (!resolvedPublicUrl) {
                    toast.error('Publish first to copy link');
                    return;
                  }
                  await navigator.clipboard.writeText(resolvedPublicUrl);
                  toast.success('Link copied');
                }}
                icon={<Copy className="h-4 w-4" />}
                disabled={!resolvedPublicUrl}
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

      <AlertModal
        open={removeFieldIndex !== null}
        onClose={() => setRemoveFieldIndex(null)}
        title="Remove Field"
        description={`Remove "${pendingField?.label || 'this field'}"? This will delete it from the form.`}
        primaryAction={{ label: 'Remove', onClick: confirmRemoveField, variant: 'danger' }}
        secondaryAction={{ label: 'Cancel', onClick: () => setRemoveFieldIndex(null), variant: 'outline' }}
      />

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
