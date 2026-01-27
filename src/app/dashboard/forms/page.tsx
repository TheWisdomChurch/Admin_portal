// src/app/dashboard/forms/page.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Plus, Link as LinkIcon, Save, Copy, Trash2 } from 'lucide-react';

import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { DataTable } from '@/components/DateTable';
import { PageHeader } from '@/layouts';
import { Input } from '@/ui/input';

import { apiClient } from '@/lib/api';
import type { AdminForm, CreateFormRequest, FormFieldType } from '@/lib/types';

import { withAuth } from '@/providers/withAuth';
import { useAuthContext } from '@/providers/AuthProviders';

type FieldDraft = {
  key: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  order: number;
  options?: { label: string; value: string }[];
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

export default withAuth(function FormsPage() {
  const router = useRouter();
  const auth = useAuthContext();

  const [forms, setForms] = useState<AdminForm[]>([]);
  const [loading, setLoading] = useState(true);

  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Builder state
  const [showBuilder, setShowBuilder] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [slug, setSlug] = useState('');
  const [publishedSlug, setPublishedSlug] = useState<string | null>(null);

  const [introTitle, setIntroTitle] = useState('Event Registration');
  const [introSubtitle, setIntroSubtitle] = useState('Secure your spot by registering below.');
  const [introBullets, setIntroBullets] = useState('Smooth check-in\nEngaging sessions\nFriendly community');
  const [introBulletSubs, setIntroBulletSubs] = useState('Arrive early for badges\nShort, powerful sessions\nMeet friendly stewards');
  const [layoutMode, setLayoutMode] = useState<'split' | 'stack'>('split');
  const [dateFormat, setDateFormat] = useState<'yyyy-mm-dd' | 'mm/dd/yyyy' | 'dd/mm/yyyy' | 'dd/mm'>('yyyy-mm-dd');

  const [footerText, setFooterText] = useState('Powered by Wisdom House Registration');
  const [footerBg, setFooterBg] = useState('#f5c400');
  const [footerTextColor, setFooterTextColor] = useState('#111827');

  const [submitButtonText, setSubmitButtonText] = useState('Submit Registration');
  const [submitButtonBg, setSubmitButtonBg] = useState('#f59e0b');
  const [submitButtonTextColor, setSubmitButtonTextColor] = useState('#111827');
  const [submitButtonIcon, setSubmitButtonIcon] = useState<'check' | 'send' | 'calendar' | 'cursor' | 'none'>('check');

  const [formHeaderNote, setFormHeaderNote] = useState('Please ensure details are accurate before submitting.');

  const [fields, setFields] = useState<FieldDraft[]>([
    { key: 'full_name', label: 'Full Name', type: 'text', required: true, order: 1 },
    { key: 'email', label: 'Email', type: 'email', required: true, order: 2 },
  ]);

  const authBlocked = useMemo(
    () => !auth.isInitialized || (auth as any).isLoading, // if your type misses isLoading, keep runtime safe
    [auth.isInitialized, (auth as any).isLoading]
  );

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.getAdminForms({ page, limit });
      setForms(Array.isArray(res.data) ? res.data : []);
      setTotal(typeof res.total === 'number' ? res.total : 0);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Failed to load forms');
      setForms([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, limit]);

  useEffect(() => {
    if (authBlocked) return;
    load();
  }, [authBlocked, load]);

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
      const url = `${origin}/forms/${res.slug}`;
      await navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard');
      load();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Failed to publish form');
    }
  };

  const handleCopyLink = async (form: AdminForm) => {
    if (!form.slug) {
      toast.error('This form is not published yet');
      return;
    }
    try {
      const origin = window.location.origin;
      const url = `${origin}/forms/${form.slug}`;
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const handleDelete = async (form: AdminForm) => {
    if (!confirm(`Delete "${form.title}"? This cannot be undone.`)) return;

    try {
      await apiClient.deleteAdminForm(form.id);
      toast.success('Form deleted');
      load();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Failed to delete form');
    }
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
        successMessage: 'Thanks! Your registration has been received.',
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
      } as any,
    };

    try {
      setSaving(true);
      const created = await apiClient.createAdminForm(payload);

      let slugToUse = created.slug || normalizedSlug;
      try {
        const published = await apiClient.publishAdminForm(created.id);
        slugToUse = published?.slug || slugToUse;
      } catch {
        // publish optional
      }

      setPublishedSlug(slugToUse);
      toast.success('Form created and link ready');
      setShowBuilder(false);
      load();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Failed to create form');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (form: AdminForm) => {
    router.push(`/dashboard/forms/${form.id}/edit`);
  };

  const columns = useMemo(
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
        key: 'slug' as keyof AdminForm,
        header: 'Link',
        cell: (f: AdminForm) => (
          <div className="flex items-center gap-2">
            {f.slug ? (
              <>
                <span className="text-xs text-secondary-600 truncate max-w-[220px]">/forms/{f.slug}</span>
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
              <span className="text-xs text-secondary-500">Not published</span>
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
    [load]
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

      {showBuilder && (
        <div className="space-y-6">
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
                      onChange={(e) => setLayoutMode(e.target.value as any)}
                      className="rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm"
                    >
                      <option value="split">Two column layout</option>
                      <option value="stack">Single column layout</option>
                    </select>
                    <select
                      value={dateFormat}
                      onChange={(e) => setDateFormat(e.target.value as any)}
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
      )}

      <Card className="p-0">
        <DataTable
          data={forms ?? []}
          columns={columns as any}
          total={total}
          page={page}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={setLimit}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onView={(f: AdminForm) => {
            if (!f.isPublished) {
              handlePublish(f);
              return;
            }
            handleCopyLink(f);
          }}
          isLoading={loading}
        />
      </Card>

      <div className="text-xs text-secondary-500">
        Tip: Click “View” action to publish (if draft) or copy link (if already published).
      </div>
    </div>
  );
}, { requiredRole: 'admin' });
