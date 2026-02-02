'use client';

// This page mirrors the rich builder experience from /dashboard/test
// so admins can create new forms from the canonical /dashboard/forms/new route.

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { ArrowLeft, Save, Plus, Trash2, Copy } from 'lucide-react';

import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { PageHeader } from '@/layouts';
import { Input } from '@/ui/input';

import { apiClient } from '@/lib/api';
import type { CreateFormRequest, FormFieldType } from '@/lib/types';

import { withAuth } from '@/providers/withAuth';
import { useAuthContext } from '@/providers/AuthProviders';
import { extractServerFieldErrors, getFirstServerFieldError, getServerErrorMessage } from '@/lib/serverValidation';

// ------------------------------------
// Types & helpers
// ------------------------------------
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

const submitButtonIcons = ['check', 'send', 'calendar', 'cursor', 'none'] as const;
type SubmitButtonIcon = (typeof submitButtonIcons)[number];

const normalizeSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');

// ------------------------------------
// Page component
// ------------------------------------
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
  const [introTitle, setIntroTitle] = useState('Event Registration');
  const [introSubtitle, setIntroSubtitle] = useState('Secure your spot by registering below.');
  const [introBullets, setIntroBullets] = useState('Smooth check-in\nEngaging sessions\nFriendly community');
  const [introBulletSubs, setIntroBulletSubs] = useState('Arrive early for badges\nShort, powerful sessions\nMeet friendly stewards');
  const [layoutMode, setLayoutMode] = useState<'split' | 'stack'>('split');
  const [dateFormat, setDateFormat] = useState<DateFormat>('yyyy-mm-dd');
  const [footerText, setFooterText] = useState('Powered by Wisdom House Registration');
  const [footerBg, setFooterBg] = useState('#f5c400');
  const [footerTextColor, setFooterTextColor] = useState('#111827');
  const [submitButtonText, setSubmitButtonText] = useState('Submit Registration');
  const [submitButtonBg, setSubmitButtonBg] = useState('#f59e0b');
  const [submitButtonTextColor, setSubmitButtonTextColor] = useState('#111827');
  const [submitButtonIcon, setSubmitButtonIcon] = useState<SubmitButtonIcon>('check');
  const [formHeaderNote, setFormHeaderNote] = useState('Please ensure details are accurate before submitting.');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const clearFieldError = (key: string) =>
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });

  // field builder
  const [fields, setFields] = useState<FieldDraft[]>([
    { key: 'full_name', label: 'Full Name', type: 'text', required: true, order: 1 },
    { key: 'email', label: 'Email', type: 'email', required: true, order: 2 },
  ]);

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
    setFieldErrors({});
    const normalizedSlug = normalizeSlug(slug);

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
      try {
        const published = await apiClient.publishAdminForm(created.id);
        slugToUse = published?.slug || slugToUse;
      } catch {
        // optional publish failure tolerated
      }
      setPublishedSlug(slugToUse);
      toast.success('Form created and link ready');
      router.push(`/dashboard/forms/${created.id}/edit`);
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
            <Input
              label="Left column title"
              value={introTitle}
              onChange={(e) => setIntroTitle(e.target.value)}
              placeholder="e.g., Event Registration"
            />
            <Input
              label="Left column subtitle"
              value={introSubtitle}
              onChange={(e) => setIntroSubtitle(e.target.value)}
              placeholder="e.g., Secure your spot..."
            />
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[var(--color-text-secondary)]">Left column bullets (one per line)</label>
              <textarea
                className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] focus:ring-offset-2"
                rows={3}
                value={introBullets}
                onChange={(e) => setIntroBullets(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[var(--color-text-secondary)]">Bullet subtext (matches order)</label>
              <textarea
                className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] focus:ring-offset-2"
                rows={3}
                value={introBulletSubs}
                onChange={(e) => setIntroBulletSubs(e.target.value)}
                placeholder="Extra note for bullet 1\nExtra note for bullet 2"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[var(--color-text-secondary)]">Form header note</label>
              <textarea
                className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] focus:ring-offset-2"
                rows={2}
                value={formHeaderNote}
                onChange={(e) => setFormHeaderNote(e.target.value)}
                placeholder="Optional short note shown above the form"
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-[var(--color-text-tertiary)]">
                Build the form fields below, then create to generate the link.
              </p>
              <div className="flex flex-wrap gap-2">
                <select
                  value={layoutMode}
                  onChange={(e) => setLayoutMode(e.target.value as 'split' | 'stack')}
                  className="rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
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
                  className="rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                >
                  <option value="yyyy-mm-dd">YYYY-MM-DD</option>
                  <option value="mm/dd/yyyy">MM/DD/YYYY</option>
                  <option value="dd/mm/yyyy">DD/MM/YYYY</option>
                  <option value="dd/mm">DD/MM</option>
                </select>
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
                  <Button variant="outline" size="sm" onClick={() => removeField(index)} icon={<Trash2 className="h-4 w-4" />}>
                    Remove
                  </Button>
                </div>
              </div>
              {(field.type === 'select' || field.type === 'radio' || field.type === 'checkbox') && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    Options (pipe separated): Value 1 | Value 2 | Value 3
                  </p>
                  <input
                    className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm"
                    value={(field.options || []).map((o) => o.label).join(' | ')}
                    onChange={(e) => {
                      const opts = e.target.value
                        .split('|')
                        .map((chunk) => chunk.trim())
                        .filter(Boolean)
                        .map((label, idx) => ({
                          label,
                          value: label.toLowerCase().replace(/\s+/g, '-') || `option-${idx + 1}`,
                        }));
                      updateField(index, { options: opts });
                    }}
                    placeholder="Gold | Silver | Bronze"
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

      <Card title="Live Preview">
        <div className={`grid gap-6 ${layoutMode === 'split' ? 'lg:grid-cols-[1.1fr_1fr]' : 'grid-cols-1'}`}>
          <div className="space-y-4 rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-gradient-to-b from-[var(--color-background-secondary)]/80 to-[var(--color-background-primary)] p-4 shadow-sm">
            <div className="inline-flex items-center rounded-full border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-3 py-1 text-xs text-[var(--color-text-secondary)]">
              Preview
            </div>
            <h2 className="text-2xl font-semibold text-[var(--color-text-primary)]">{introTitle || 'Event Registration'}</h2>
            <p className="text-sm text-[var(--color-text-secondary)]">{introSubtitle || 'Secure your spot by registering below.'}</p>
            {formHeaderNote && (
              <p className="text-xs text-[var(--color-text-tertiary)]">{formHeaderNote}</p>
            )}
            <div className="grid gap-3">
              {introBullets.split('\n').filter(Boolean).map((item, idx) => {
                const sub = introBulletSubs.split('\n')[idx];
                return (
                  <div
                    key={idx}
                    className="flex items-center gap-3 rounded-[18px] border border-[var(--color-border-secondary)] bg-gradient-to-r from-[var(--color-background-secondary)] to-[var(--color-background-primary)] px-4 py-3 shadow-[0_12px_28px_-20px_rgba(0,0,0,0.55)]"
                  >
                    <div className="h-8 w-8 rounded-full bg-[var(--color-accent-primary)]/15 flex items-center justify-center text-[var(--color-accent-primary)] font-semibold">
                      {idx + 1}
                    </div>
                    <div className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                      <div className="font-medium text-[var(--color-text-primary)]">{item}</div>
                      {sub && <div className="text-xs text-[var(--color-text-tertiary)] mt-1">{sub}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-5 shadow-sm space-y-4">
            {fields.map((field, idx) => (
              <div key={idx} className="space-y-1">
                {field.type !== 'checkbox' && (
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
                    {field.label} {field.required ? <span className="text-red-500">*</span> : null}
                  </label>
                )}
                {field.type === 'textarea' ? (
                  <textarea
                    disabled
                    className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-white px-3 py-2 text-sm text-[var(--color-text-primary)]"
                    rows={3}
                    placeholder={field.label}
                  />
                ) : field.type === 'select' ? (
                  <select
                    disabled
                    className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-white px-3 py-2 text-sm text-[var(--color-text-primary)]"
                  >
                    <option value="">Select...</option>
                    {(field.options || []).map((opt) => (
                      <option key={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                ) : field.type === 'checkbox' ? (
                  field.options && field.options.length > 0 ? (
                    <div className="space-y-1">
                      {(field.options || []).map((opt) => (
                        <label key={opt.value} className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                          <input type="checkbox" disabled className="h-4 w-4 rounded border-[var(--color-border-primary)]" />
                          {opt.label}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                      <input type="checkbox" disabled className="h-4 w-4 rounded border-[var(--color-border-primary)]" />
                      {field.label}
                    </label>
                  )
                ) : field.type === 'radio' ? (
                  <div className="space-y-1">
                    <p className="text-xs text-[var(--color-text-tertiary)]">{field.label}</p>
                    {(field.options || []).map((opt) => (
                      <label key={opt.value} className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                        <input type="radio" disabled className="h-4 w-4 border-[var(--color-border-primary)]" />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                ) : field.type === 'date' ? (
                  <input
                    disabled
                    type="date"
                    className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-white px-3 py-2 text-sm text-[var(--color-text-primary)]"
                    placeholder={field.label}
                  />
                ) : (
                  <input
                    disabled
                    type={field.type}
                    className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-white px-3 py-2 text-sm text-[var(--color-text-primary)]"
                    placeholder={field.label}
                  />
                )}
                {field.type === 'date' && (
                  <p className="text-[11px] text-[var(--color-text-tertiary)]">Format: {dateFormat.toUpperCase()}</p>
                )}
              </div>
            ))}
            <div className="pt-3">
              <button
                type="button"
                disabled
                className="w-full rounded-[var(--radius-button)] px-4 py-2.5 text-sm font-semibold shadow-sm"
                style={{ background: submitButtonBg, color: submitButtonTextColor, opacity: 0.9 }}
              >
                <span className="inline-flex items-center gap-2 justify-center">
                  {submitButtonIcon !== 'none' && (
                    submitButtonIcon === 'check' ? <span>✔</span> :
                    submitButtonIcon === 'send' ? <span>➜</span> :
                    submitButtonIcon === 'calendar' ? <span>📅</span> :
                    submitButtonIcon === 'cursor' ? <span>✦</span> : null
                  )}
                  {submitButtonText || 'Submit Registration'}
                </span>
              </button>
            </div>
            <div
              className="mt-4 rounded-[var(--radius-card)] px-3 py-2 text-center text-xs font-medium"
              style={{ background: footerBg, color: footerTextColor }}
            >
              {footerText}
            </div>
          </div>
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

      <Card title="Footer & Submit styling">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-3">
            <Input label="Footer text" value={footerText} onChange={(e) => setFooterText(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-[var(--color-text-secondary)]">Footer background</label>
                <input
                  type="color"
                  value={footerBg}
                  onChange={(e) => setFooterBg(e.target.value)}
                  className="h-10 w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)]"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-[var(--color-text-secondary)]">Footer text color</label>
                <input
                  type="color"
                  value={footerTextColor}
                  onChange={(e) => setFooterTextColor(e.target.value)}
                  className="h-10 w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)]"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Input label="Submit button text" value={submitButtonText} onChange={(e) => setSubmitButtonText(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-[var(--color-text-secondary)]">Submit icon</label>
                <select
                  value={submitButtonIcon}
                  onChange={(e) => {
                    const next = e.target.value as SubmitButtonIcon;
                    if (submitButtonIcons.includes(next)) setSubmitButtonIcon(next);
                  }}
                  className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                >
                  <option value="check">Check</option>
                  <option value="send">Send</option>
                  <option value="calendar">Calendar</option>
                  <option value="cursor">Pointer</option>
                  <option value="none">No icon</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-[var(--color-text-secondary)]">Button background</label>
                <input
                  type="color"
                  value={submitButtonBg}
                  onChange={(e) => setSubmitButtonBg(e.target.value)}
                  className="h-10 w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)]"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-[var(--color-text-secondary)]">Button text color</label>
                <input
                  type="color"
                  value={submitButtonTextColor}
                  onChange={(e) => setSubmitButtonTextColor(e.target.value)}
                  className="h-10 w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)]"
                />
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}, { requiredRole: 'admin' });
