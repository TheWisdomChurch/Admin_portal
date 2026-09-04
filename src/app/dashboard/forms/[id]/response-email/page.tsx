'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { ArrowLeft, Code2, Eye, LayoutTemplate, MailCheck, Save } from 'lucide-react';

import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Input } from '@/ui/Input';
import { PageHeader } from '@/layouts';
import { withAuth } from '@/providers/withAuth';
import { apiClient } from '@/lib/api';
import {
  ACCEPTED_EMAIL_IMAGE_TYPES,
  MAX_EMAIL_IMAGE_BYTES,
  MAX_EMAIL_IMAGE_MB,
  buildFormEmailTextBody,
  normalizeAbsoluteHttpUrl,
  normalizeTemplateSlug,
  parseTemplateMeta,
  toEmailPreview,
} from '@/lib/forms/formEmailTemplates';
import type { AdminForm, EmailTemplate, FormEmailContent, UpdateFormRequest } from '@/lib/types';
import { getServerErrorMessage } from '@/lib/serverValidation';

// A small debounce so the live preview doesn't fire a network request on
// every keystroke — it still calls the backend's real render path
// (apiClient.previewAdminEmailTemplate), just not on every character typed.
const PREVIEW_DEBOUNCE_MS = 400;

function ResponseEmailEditorPage() {
  const params = useParams();
  const router = useRouter();
  const formId = useMemo(() => {
    const raw = params?.id;
    return typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : '';
  }, [params]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<AdminForm | null>(null);
  const [template, setTemplate] = useState<EmailTemplate | null>(null);

  const [subject, setSubject] = useState('');
  const [heading, setHeading] = useState('Registration Confirmed');
  const [message, setMessage] = useState('Thank you for registering. Your details have been received successfully.');
  const [imageUrl, setImageUrl] = useState('');

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [customHtmlBody, setCustomHtmlBody] = useState('');
  const [previewMode, setPreviewMode] = useState<'rendered' | 'html'>('rendered');

  // Structured-mode preview comes from the backend's real render path
  // (the same one Save uses) rather than a locally hand-built copy — see
  // apiClient.previewAdminEmailTemplate.
  const [renderedPreviewHTML, setRenderedPreviewHTML] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  const templateKeyPreview = useMemo(() => {
    const existing = form?.settings?.responseEmailTemplateKey?.trim();
    if (existing) return existing;
    if (form?.slug) return `forms/${form.slug}`;
    if (form?.title) return `forms/${normalizeTemplateSlug(form.title)}`;
    if (form?.id) return `forms/${form.id}`;
    return '';
  }, [form]);
  const includeRegistrationArtifacts = useMemo(() => {
    const target = form?.settings?.submissionTarget?.trim().toLowerCase() || '';
    const formType = form?.settings?.formType?.trim().toLowerCase() || '';
    if (target === 'testimonial' || target === 'member' || target === 'leadership') {
      return false;
    }
    return formType === 'event' || formType === 'registration' || formType === 'workforce';
  }, [form?.settings?.formType, form?.settings?.submissionTarget]);

  // The structured content sent to (and rendered by) the backend. Building
  // this is the only "template construction" this page does now — turning
  // it into HTML is entirely the backend's job (RenderFormEmailContent), for
  // both the live preview below and the actual save.
  const structuredContent = useMemo<FormEmailContent>(() => ({
    heading: heading.trim(),
    message: message.trim(),
    imageUrl: (imagePreview || imageUrl || '').trim() || undefined,
    includeRegistrationCode: includeRegistrationArtifacts,
    includeCalendarOptIn: includeRegistrationArtifacts,
  }), [heading, imagePreview, imageUrl, includeRegistrationArtifacts, message]);

  const usingCustomHtml = customHtmlBody.trim().length > 0;

  useEffect(() => {
    if (usingCustomHtml) return;

    let cancelled = false;
    setPreviewLoading(true);
    const timer = setTimeout(() => {
      apiClient
        .previewAdminEmailTemplate(structuredContent)
        .then((res) => {
          if (!cancelled) setRenderedPreviewHTML(toEmailPreview(res.htmlBody));
        })
        .catch((err) => {
          if (!cancelled) toast.error(getServerErrorMessage(err, 'Failed to render preview.'));
        })
        .finally(() => {
          if (!cancelled) setPreviewLoading(false);
        });
    }, PREVIEW_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [structuredContent, usingCustomHtml]);

  const previewHTML = usingCustomHtml ? toEmailPreview(customHtmlBody) : renderedPreviewHTML;

  const validateImageFile = (file: File): string | null => {
    if (!ACCEPTED_EMAIL_IMAGE_TYPES.includes(file.type)) {
      return 'Image must be JPEG, PNG, or WebP.';
    }
    if (file.size > MAX_EMAIL_IMAGE_BYTES) {
      return `Image must be ${MAX_EMAIL_IMAGE_MB}MB or smaller.`;
    }
    return null;
  };

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  useEffect(() => {
    if (!formId) return;
    (async () => {
      try {
        const loadedForm = await apiClient.getAdminForm(formId);
        setForm(loadedForm);

        const target = loadedForm.settings?.submissionTarget?.trim().toLowerCase() || '';
        const formType = loadedForm.settings?.formType?.trim().toLowerCase() || '';
        const isTestimonialForm = target === 'testimonial' || formType === 'testimonial';
        const supportsRegistrationArtifacts =
          !isTestimonialForm &&
          target !== 'member' &&
          target !== 'leadership' &&
          (formType === 'event' || formType === 'registration' || formType === 'workforce');
        const subjectPrefix = isTestimonialForm
          ? 'Testimony received'
          : supportsRegistrationArtifacts
            ? 'Registration received'
            : 'Submission received';
        const subjectFallback =
          loadedForm.settings?.responseEmailSubject?.trim() || `${subjectPrefix}: ${loadedForm.title}`;
        setSubject(subjectFallback);
        setImageUrl(loadedForm.settings?.responseEmailTemplateUrl?.trim() || '');

        const res = await apiClient.listAdminEmailTemplates({
          page: 1,
          limit: 50,
          ownerType: 'form',
          ownerId: formId,
        });
        const active = res.data.find((item) => item.isActive);
        const latest = [...res.data].sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1))[0];
        const tpl = active || latest || null;

        if (tpl) {
          setTemplate(tpl);
          if (tpl.subject?.trim()) setSubject(tpl.subject.trim());

          if (tpl.content) {
            // Current shape: structured content the backend renders.
            if (tpl.content.heading) setHeading(tpl.content.heading);
            if (tpl.content.message) setMessage(tpl.content.message);
            if (tpl.content.imageUrl) setImageUrl(tpl.content.imageUrl);
          } else {
            // Legacy template saved before content-driven rendering existed.
            // Older saves may carry heading/message in an embedded HTML
            // comment (parseTemplateMeta); fall back to treating the whole
            // body as hand-authored HTML either way. Saving this form again
            // upgrades it to a content-driven template going forward.
            const meta = parseTemplateMeta(tpl.htmlBody);
            if (meta?.heading) setHeading(meta.heading);
            if (meta?.message) setMessage(meta.message);
            if (meta?.imageUrl) setImageUrl(meta.imageUrl);
            setCustomHtmlBody(tpl.htmlBody);
          }
        }
      } catch (err) {
        toast.error(getServerErrorMessage(err, 'Failed to load form email template.'));
        router.push('/dashboard/forms');
      } finally {
        setLoading(false);
      }
    })();
  }, [formId, router]);

  const handleImageFile = (file?: File) => {
    if (!file) {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      setImageFile(null);
      setImagePreview(null);
      return;
    }
    const err = validateImageFile(file);
    if (err) {
      toast.error(err);
      return;
    }
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const saveTemplate = async () => {
    if (!form) return;
    if (!subject.trim()) {
      toast.error('Email subject is required.');
      return;
    }

    setSaving(true);
    try {
      let nextImageUrl = normalizeAbsoluteHttpUrl(imageUrl);
      if (imageUrl.trim() && !nextImageUrl) {
        toast.error('Template image URL is invalid. Use a full URL like https://...png');
        setSaving(false);
        return;
      }

      if (imageFile) {
        const uploaded = await apiClient.uploadImage(imageFile, 'email_template');
        nextImageUrl = uploaded.url;
      }

      const templateKey = templateKeyPreview || `forms/${form.id}`;

      // Structured mode (the default): send content, let the backend render
      // it via the shared theme — never a locally hand-built htmlBody.
      // Custom-HTML mode (the "Custom HTML template" field below, non-empty):
      // pass that HTML through as-is, exactly as before — an explicit
      // one-off escape hatch, not a second copy of the default design.
      const content: FormEmailContent | undefined = usingCustomHtml
        ? undefined
        : { ...structuredContent, imageUrl: nextImageUrl || undefined };
      const htmlBody = usingCustomHtml ? customHtmlBody.trim() : undefined;
      const textBody = usingCustomHtml
        ? buildFormEmailTextBody({ title: form.title || 'Registration', heading: heading.trim(), message: message.trim() })
        : undefined;

      let savedTemplate: EmailTemplate;
      if (template) {
        savedTemplate = await apiClient.updateAdminEmailTemplate(template.id, {
          templateKey,
          ownerType: 'form',
          ownerId: form.id,
          subject: subject.trim(),
          content,
          htmlBody,
          textBody,
          status: 'active',
          activate: true,
        });
      } else {
        savedTemplate = await apiClient.createAdminEmailTemplate({
          templateKey,
          ownerType: 'form',
          ownerId: form.id,
          subject: subject.trim(),
          content,
          htmlBody,
          textBody,
          status: 'active',
          activate: true,
        });
      }

      const settingsUpdate: UpdateFormRequest = {
        settings: {
          ...form.settings,
          responseEmailEnabled: true,
          responseEmailSubject: subject.trim() || undefined,
          responseEmailTemplateId: savedTemplate.id,
          responseEmailTemplateKey: templateKey,
          responseEmailTemplateUrl: nextImageUrl || undefined,
        },
      };
      const updatedForm = await apiClient.updateAdminForm(form.id, settingsUpdate);

      setForm(updatedForm);
      setTemplate(savedTemplate);
      setImageUrl(nextImageUrl);
      setImageFile(null);
      setImagePreview(null);

      toast.success('Response email template saved.');
    } catch (err) {
      toast.error(getServerErrorMessage(err, 'Failed to save response email template.'));
    } finally {
      setSaving(false);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Response Email Editor"
          subtitle={`Manage the auto-response email sent after ${form.title} submissions.`}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/dashboard/forms/${form.id}/edit`)}
            icon={<ArrowLeft className="h-4 w-4" />}
          >
            Back to Form
          </Button>
          <Button onClick={saveTemplate} loading={saving} icon={<Save className="h-4 w-4" />}>
            Save Template
          </Button>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[var(--radius-card)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Template Status</p>
          <p className="mt-2 text-base font-semibold text-[var(--color-text-primary)]">{template ? 'Active' : 'Draft setup'}</p>
        </div>
        <div className="rounded-[var(--radius-card)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Form</p>
          <p className="mt-2 truncate text-base font-semibold text-[var(--color-text-primary)]">{form.title}</p>
        </div>
        <div className="rounded-[var(--radius-card)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] p-4 sm:col-span-2">
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Template Key</p>
          <p className="mt-2 truncate font-mono text-sm text-[var(--color-text-primary)]">{templateKeyPreview || 'Not generated yet'}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(460px,0.9fr)]">
        <Card
          title="Template Builder"
          className="bg-[var(--color-background-secondary)]"
          contentClassName="space-y-6"
        >
          <section className="grid gap-4 md:grid-cols-2">
            <Input
              label="Email subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Registration received: Program Name"
            />
            <Input
              label="Template key"
              value={templateKeyPreview}
              disabled
              helperText="Linked to this form's auto-response template."
            />
            <Input
              label="Email heading"
              value={heading}
              onChange={(e) => setHeading(e.target.value)}
              placeholder="Registration Confirmed"
            />
            <Input
              label="Template image URL (optional)"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://.../hero.png"
              helperText="The church logo and header come from the shared brand design automatically."
            />
            <div className="rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-primary)] p-3 md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-[var(--color-text-secondary)]">Upload template image (optional)</label>
              {/* eslint-disable-next-line no-restricted-syntax -- file input, styled with tokens */}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageFile(e.target.files?.[0])}
                className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm"
              />
              <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">Max {MAX_EMAIL_IMAGE_MB}MB. JPEG, PNG, WebP.</p>
            </div>
          </section>

          <section className="space-y-2">
            <label className="block text-sm font-medium text-[var(--color-text-secondary)]">Email body message</label>
            <textarea
              className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-primary)] px-4 py-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] focus:ring-offset-2"
              rows={7}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Thank you for registering. We look forward to hosting you."
            />
          </section>

          <section className="space-y-2">
            <label className="block text-sm font-medium text-[var(--color-text-secondary)]">Custom HTML template (optional)</label>
            <textarea
              className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-primary)] px-4 py-3 font-mono text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] focus:ring-offset-2"
              rows={14}
              value={customHtmlBody}
              onChange={(e) => setCustomHtmlBody(e.target.value)}
              placeholder="Paste full HTML for complete control. Supported placeholders: {{.RecipientName}}, {{.RegistrationCode}}, {{.SubscribeURL}}, {{.UnsubscribeURL}}, {{.CalendarOptInURL}}."
            />
            <p className="text-xs text-[var(--color-text-tertiary)]">Leave empty to use the structured editor.</p>
          </section>
        </Card>

        <Card
          title="Live Preview"
          className="bg-[var(--color-background-secondary)] xl:sticky xl:top-24 h-fit"
          actions={
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={previewMode === 'rendered' ? 'primary' : 'outline'}
                icon={<Eye className="h-4 w-4" />}
                onClick={() => setPreviewMode('rendered')}
              >
                Rendered
              </Button>
              <Button
                type="button"
                size="sm"
                variant={previewMode === 'html' ? 'primary' : 'outline'}
                icon={<Code2 className="h-4 w-4" />}
                onClick={() => setPreviewMode('html')}
              >
                HTML
              </Button>
            </div>
          }
          contentClassName="space-y-3"
        >
          <div className="flex items-center gap-2 rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 py-2 text-xs text-[var(--color-text-tertiary)]">
            <LayoutTemplate className="h-4 w-4 text-[var(--color-text-secondary)]" />
            {previewLoading && !usingCustomHtml
              ? 'Rendering preview…'
              : `Uses sample values for name${includeRegistrationArtifacts ? ' and registration number' : ''} in preview.`}
            <MailCheck className="ml-auto h-4 w-4 text-[var(--color-accent-success)]" />
          </div>

          {previewMode === 'rendered' ? (
            <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-white">
              <iframe title="email-preview" srcDoc={previewHTML} className="h-[760px] w-full" />
            </div>
          ) : (
            <pre className="max-h-[760px] overflow-auto rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-4 text-xs leading-relaxed text-[var(--color-text-primary)]">
              {previewHTML}
            </pre>
          )}
        </Card>
      </div>
    </div>
  );
}

export default withAuth(ResponseEmailEditorPage);
