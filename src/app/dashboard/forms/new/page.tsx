'use client';

// This page mirrors the rich builder experience from /dashboard/test
// so admins can create new forms from the canonical /dashboard/forms/new route.

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { ArrowLeft, Save, Plus, Trash2, Copy } from 'lucide-react';

import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { PageHeader } from '@/layouts';
import { Input } from '@/ui/input';
import { AlertModal } from '@/ui/AlertModal';

import { apiClient } from '@/lib/api';
import { buildPublicFormUrl } from '@/lib/utils';
import { createFormSchema } from '@/lib/validation/forms';
import type { CreateFormRequest, EventData, FormFieldType } from '@/lib/types';

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

const MAX_BANNER_MB = 5;
const MAX_BANNER_BYTES = MAX_BANNER_MB * 1024 * 1024;
const ACCEPTED_BANNER_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const normalizeSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const renderStructuredLines = (value: string) => {
  const lines = value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const bullets = lines
    .filter((line) => line.startsWith('- ') || line.startsWith('* '))
    .map((line) => line.replace(/^(-|\*)\s+/, '').trim())
    .filter(Boolean);

  const paragraphs = lines.filter((line) => !line.startsWith('- ') && !line.startsWith('* '));
  return { bullets, paragraphs };
};

const buildResponseEmailHTML = (opts: {
  title: string;
  heading: string;
  message: string;
  imageUrl?: string;
}) => {
  const safeTitle = escapeHtml(opts.title || 'Registration');
  const safeHeading = escapeHtml(opts.heading || 'Registration Confirmed');
  const safeMessage = escapeHtml(opts.message || 'Thank you for registering.');
  const safeImageUrl = opts.imageUrl ? escapeHtml(opts.imageUrl) : '';

  return `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f5f7fb;font-family:Arial,sans-serif;color:#111827;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="padding:24px 24px 10px 24px;">
                <p style="margin:0 0 10px 0;font-size:14px;color:#6b7280;">Wisdom Church Registration</p>
                <h2 style="margin:0;font-size:24px;line-height:1.25;color:#111827;">${safeHeading}</h2>
              </td>
            </tr>
            ${safeImageUrl ? `<tr><td style="padding:10px 24px 0 24px;"><img src="${safeImageUrl}" alt="${safeTitle}" style="display:block;width:100%;height:auto;border-radius:10px;" /></td></tr>` : ''}
            <tr>
              <td style="padding:18px 24px 12px 24px;">
                <p style="margin:0 0 14px 0;font-size:16px;color:#111827;">Hello {{.RecipientName}},</p>
                <p style="margin:0;font-size:15px;line-height:1.7;color:#374151;">${safeMessage}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 24px 24px 24px;">
                <a href="{{.FormURL}}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px;font-size:14px;">View Registration Page</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`.trim();
};

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
  const [footerText, setFooterText] = useState('Powered by Wisdom House Registration');
  const [footerBg, setFooterBg] = useState('#f5c400');
  const [footerTextColor, setFooterTextColor] = useState('#111827');
  const [submitButtonText, setSubmitButtonText] = useState('Submit Registration');
  const [submitButtonBg, setSubmitButtonBg] = useState('#f59e0b');
  const [submitButtonTextColor, setSubmitButtonTextColor] = useState('#111827');
  const [submitButtonIcon, setSubmitButtonIcon] = useState<SubmitButtonIcon>('check');
  const [formHeaderNote, setFormHeaderNote] = useState('Please ensure details are accurate before submitting.');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [successTitle, setSuccessTitle] = useState('');
  const [successSubtitle, setSuccessSubtitle] = useState('');
  const [successMessage, setSuccessMessage] = useState('We would love to see you.');
  const [responseEmailEnabled, setResponseEmailEnabled] = useState(true);
  const [responseEmailSubject, setResponseEmailSubject] = useState('');
  const [responseEmailHeading, setResponseEmailHeading] = useState('Registration Confirmed');
  const [responseEmailMessage, setResponseEmailMessage] = useState('Thank you for registering. Your details have been received successfully.');
  const [responseTemplateFile, setResponseTemplateFile] = useState<File | null>(null);
  const [responseTemplatePreview, setResponseTemplatePreview] = useState<string | null>(null);
  const [responseTemplateUrl, setResponseTemplateUrl] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [removeFieldIndex, setRemoveFieldIndex] = useState<number | null>(null);
  const descriptionStructure = useMemo(() => renderStructuredLines(description), [description]);
  const responseTemplateKeyPreview = useMemo(
    () => `forms/${normalizeSlug(slug || title || 'your-link')}`,
    [slug, title]
  );

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
      if (responseTemplatePreview) URL.revokeObjectURL(responseTemplatePreview);
    };
  }, [bannerPreview, responseTemplatePreview]);

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

  const handleResponseTemplateFile = (file?: File) => {
    if (!file) {
      setResponseTemplateFile(null);
      setResponseTemplatePreview(null);
      return;
    }
    const error = validateBannerFile(file);
    if (error) {
      toast.error(error);
      setResponseTemplateFile(null);
      setResponseTemplatePreview(null);
      return;
    }
    setResponseTemplateFile(file);
    setResponseTemplatePreview(URL.createObjectURL(file));
  };

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

  const requestRemoveField = (index: number) => {
    setRemoveFieldIndex(index);
  };

  const confirmRemoveField = () => {
    if (removeFieldIndex === null) return;
    setFields((prev) => prev.filter((_, i) => i !== removeFieldIndex));
    setRemoveFieldIndex(null);
  };

  const save = async () => {
    setFieldErrors({});
    const normalizedSlug = normalizeSlug(slug || title);

    const payload: CreateFormRequest = {
      title: title.trim(),
      description: description.trim() || undefined,
      slug: normalizedSlug,
      eventId: eventId || undefined,
      fields: fields.map((f, idx) => ({
        key: (f.key || `field_${idx + 1}`).trim(),
        label: f.label.trim(),
        type: f.type,
        required: f.required,
        options: f.options,
        order: idx + 1,
      })),
      settings: {
        capacity: capacity ? Number(capacity) : undefined,
        closesAt: toIso(closesAt),
        expiresAt: toIso(expiresAt),
        responseEmailEnabled,
        responseEmailSubject: responseEmailSubject.trim() || undefined,
        responseEmailTemplateKey: responseEmailEnabled ? `forms/${normalizedSlug}` : undefined,
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
      let publishedOk = false;
      let publishError: string | null = null;
      try {
        const published = await apiClient.publishAdminForm(created.id);
        slugToUse = published?.slug || slugToUse;
        publishedOk = true;
      } catch (err) {
        publishedOk = false;
        publishError = getServerErrorMessage(err, 'Publish failed. Form saved as draft.');
      }

      if (responseEmailEnabled) {
        try {
          let templateImageUrl = responseTemplateUrl.trim();
          if (responseTemplateFile) {
            const uploaded = await apiClient.uploadImage(responseTemplateFile, 'email_template');
            templateImageUrl = uploaded.url;
          }

          const templateKey = `forms/${slugToUse}`;
          const templateSubject =
            responseEmailSubject.trim() || `Registration received: ${title.trim() || slugToUse}`;
          const htmlBody = buildResponseEmailHTML({
            title: title.trim() || slugToUse,
            heading: responseEmailHeading.trim(),
            message: responseEmailMessage.trim(),
            imageUrl: templateImageUrl || undefined,
          });

          await apiClient.createAdminEmailTemplate({
            templateKey,
            ownerType: 'form',
            ownerId: created.id,
            subject: templateSubject,
            htmlBody,
            status: 'active',
            activate: true,
          });
          toast.success('Response email template attached');
        } catch (templateErr) {
          const templateMsg = getServerErrorMessage(
            templateErr,
            'Form was created, but response email template setup failed.'
          );
          toast.error(templateMsg);
        }
      }

      setPublishedSlug(publishedOk ? slugToUse : null);
      if (publishedOk) {
        toast.success('Form created and link ready');
      } else {
        toast.success('Form created');
        toast.error(publishError || 'Publish the form to get a live link.');
      }
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

  const pendingField = removeFieldIndex !== null ? fields[removeFieldIndex] : null;

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
                /forms/{normalizeSlug(slug || title || 'your-link')}
              </span>
            </p>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Description</label>
            <textarea
              className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] focus:ring-offset-2"
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Write a clean short description. Use new lines for spacing. Use '- ' for bullet points."
            />
            <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">
              Tip: keep this concise. Use paragraphs and bullet points so visitors can scan quickly.
            </p>
            {(descriptionStructure.paragraphs.length > 0 || descriptionStructure.bullets.length > 0) && (
              <div className="mt-3 rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
                  Description Preview
                </p>
                <div className="space-y-2 text-sm text-[var(--color-text-secondary)]">
                  {descriptionStructure.paragraphs.map((paragraph, index) => (
                    <p key={`description-paragraph-${index}`}>{paragraph}</p>
                  ))}
                  {descriptionStructure.bullets.length > 0 && (
                    <ul className="list-disc space-y-1 pl-5">
                      {descriptionStructure.bullets.map((item, index) => (
                        <li key={`description-bullet-${index}`}>{item}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
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
                className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] focus:ring-offset-2"
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

          <div className="md:col-span-2 rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Response Email Template</h3>
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  Attach a unique template to this form. It is sent automatically after successful submission.
                </p>
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                <input
                  type="checkbox"
                  checked={responseEmailEnabled}
                  onChange={(e) => setResponseEmailEnabled(e.target.checked)}
                />
                Enable
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Input
                label="Email subject"
                value={responseEmailSubject}
                onChange={(e) => setResponseEmailSubject(e.target.value)}
                placeholder="Registration received: Program Name"
                disabled={!responseEmailEnabled}
              />
              <Input
                label="Template key (auto)"
                value={responseTemplateKeyPreview}
                disabled
                helperText="This key is linked to the form and used for unique template lookup."
              />
              <Input
                label="Email heading"
                value={responseEmailHeading}
                onChange={(e) => setResponseEmailHeading(e.target.value)}
                placeholder="Registration Confirmed"
                disabled={!responseEmailEnabled}
              />
              <Input
                label="Template image URL (optional)"
                value={responseTemplateUrl}
                onChange={(e) => setResponseTemplateUrl(e.target.value)}
                placeholder="https://..."
                disabled={!responseEmailEnabled}
              />
              <Input
                label="Or upload template image"
                type="file"
                accept="image/*"
                onChange={(e) => handleResponseTemplateFile(e.target.files?.[0])}
                helperText="Image is uploaded to your bucket and injected into the response email."
                disabled={!responseEmailEnabled}
              />
              <div className="space-y-2 md:col-span-2">
                <label className="block text-sm font-medium text-[var(--color-text-secondary)]">Email body message</label>
                <textarea
                  className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] focus:ring-offset-2"
                  rows={3}
                  value={responseEmailMessage}
                  onChange={(e) => setResponseEmailMessage(e.target.value)}
                  placeholder="Thank you for registering. We look forward to hosting you."
                  disabled={!responseEmailEnabled}
                />
              </div>
            </div>

            {(responseTemplatePreview || responseTemplateUrl.trim()) && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-[var(--color-text-secondary)]">Email image preview</p>
                <Image
                  src={responseTemplatePreview || responseTemplateUrl.trim()}
                  alt="Response template preview"
                  width={1200}
                  height={400}
                  className="w-full max-h-64 rounded-[var(--radius-card)] object-cover border border-[var(--color-border-secondary)]"
                  unoptimized
                />
              </div>
            )}
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

      <Card className="p-6">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Registration Settings</h3>
        <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">
          Control capacity and registration window for this form.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
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
                        <input type="radio" disabled className="h-4 w-4 rounded-full border-[var(--color-border-primary)]" />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                ) : field.type === 'image' ? (
                  <div className="space-y-1">
                    <input
                      disabled
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-white px-3 py-2 text-sm text-[var(--color-text-primary)]"
                    />
                    <p className="text-[11px] text-[var(--color-text-tertiary)]">JPEG, PNG, WebP up to 5MB</p>
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
            {publishedSlug ? (buildPublicFormUrl(publishedSlug) ?? `/forms/${publishedSlug}`) : 'Create & publish to generate link'}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              if (!publishedSlug) {
                toast.error('Publish first to copy link');
                return;
              }
              const url = buildPublicFormUrl(publishedSlug) ?? `/forms/${encodeURIComponent(publishedSlug)}`;
              await navigator.clipboard.writeText(url);
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
}, { requiredRole: 'admin' });
