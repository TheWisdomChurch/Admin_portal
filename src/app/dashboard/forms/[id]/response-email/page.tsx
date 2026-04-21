'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { ArrowLeft, Save, Upload } from 'lucide-react';

import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Input } from '@/ui/input';
import { PageHeader } from '@/layouts';
import { withAuth } from '@/providers/withAuth';
import { apiClient } from '@/lib/api';
import {
  ACCEPTED_EMAIL_IMAGE_TYPES,
  MAX_EMAIL_IMAGE_BYTES,
  MAX_EMAIL_IMAGE_MB,
  buildFormEmailHTML,
  buildFormEmailTextBody,
  embedTemplateMeta,
  normalizeAbsoluteHttpUrl,
  normalizeTemplateSlug,
  parseTemplateMeta,
  stripTemplateMeta,
  toEmailPreview,
} from '@/lib/formEmailTemplates';
import type { AdminForm, EmailTemplate, UpdateFormRequest } from '@/lib/types';
import { getServerErrorMessage } from '@/lib/serverValidation';

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
  const [logoUrl, setLogoUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [customHtmlBody, setCustomHtmlBody] = useState('');

  const templateKeyPreview = useMemo(() => {
    const existing = form?.settings?.responseEmailTemplateKey?.trim();
    if (existing) return existing;
    if (form?.slug) return `forms/${form.slug}`;
    if (form?.title) return `forms/${normalizeTemplateSlug(form.title)}`;
    if (form?.id) return `forms/${form.id}`;
    return '';
  }, [form]);
  const isTestimonialTarget = useMemo(() => {
    const target = form?.settings?.submissionTarget?.trim().toLowerCase() || '';
    const formType = form?.settings?.formType?.trim().toLowerCase() || '';
    return target === 'testimonial' || formType === 'testimonial';
  }, [form?.settings?.formType, form?.settings?.submissionTarget]);

  const previewHTML = useMemo(() => {
    const generated = buildFormEmailHTML({
      title: form?.title || 'Registration',
      heading,
      message,
      logoUrl: logoPreview || logoUrl || undefined,
      imageUrl: imagePreview || imageUrl || undefined,
      includeRegistrationCode: !isTestimonialTarget,
      includeCalendarOptIn: !isTestimonialTarget,
      greeting: 'Hello {{.RecipientName}},',
    });
    return toEmailPreview(customHtmlBody.trim() || generated);
  }, [
    customHtmlBody,
    form?.title,
    heading,
    imagePreview,
    imageUrl,
    isTestimonialTarget,
    logoPreview,
    logoUrl,
    message,
  ]);

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
      if (logoPreview) URL.revokeObjectURL(logoPreview);
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [logoPreview, imagePreview]);

  useEffect(() => {
    if (!formId) return;
    (async () => {
      try {
        const loadedForm = await apiClient.getAdminForm(formId);
        setForm(loadedForm);

        const subjectFallback =
          loadedForm.settings?.responseEmailSubject?.trim() || `Registration received: ${loadedForm.title}`;
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
          const meta = parseTemplateMeta(tpl.htmlBody);
          if (meta?.heading) setHeading(meta.heading);
          if (meta?.message) setMessage(meta.message);
          if (meta?.logoUrl) setLogoUrl(meta.logoUrl);
          if (meta?.imageUrl) setImageUrl(meta.imageUrl);
          if (meta?.customHtml) setCustomHtmlBody(stripTemplateMeta(meta.customHtml));
          else setCustomHtmlBody(stripTemplateMeta(tpl.htmlBody));
        }
      } catch (err) {
        toast.error(getServerErrorMessage(err, 'Failed to load form email template.'));
        router.push('/dashboard/forms');
      } finally {
        setLoading(false);
      }
    })();
  }, [formId, router]);

  const handleLogoFile = (file?: File) => {
    if (!file) {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
      setLogoFile(null);
      setLogoPreview(null);
      return;
    }
    const err = validateImageFile(file);
    if (err) {
      toast.error(err);
      return;
    }
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

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
      let nextLogoUrl = normalizeAbsoluteHttpUrl(logoUrl);
      let nextImageUrl = normalizeAbsoluteHttpUrl(imageUrl);
      if (logoUrl.trim() && !nextLogoUrl) {
        toast.error('Logo URL is invalid. Use a full URL like https://...png');
        setSaving(false);
        return;
      }
      if (imageUrl.trim() && !nextImageUrl) {
        toast.error('Template image URL is invalid. Use a full URL like https://...png');
        setSaving(false);
        return;
      }

      if (logoFile) {
        const uploaded = await apiClient.uploadImage(logoFile, 'email_template');
        nextLogoUrl = uploaded.url;
      }
      if (imageFile) {
        const uploaded = await apiClient.uploadImage(imageFile, 'email_template');
        nextImageUrl = uploaded.url;
      }

      const templateKey = templateKeyPreview || `forms/${form.id}`;
      const builtHtml = buildFormEmailHTML({
        title: form.title || 'Registration',
        heading: heading.trim(),
        message: message.trim(),
        logoUrl: nextLogoUrl || undefined,
        imageUrl: nextImageUrl || undefined,
        includeRegistrationCode: !isTestimonialTarget,
        includeCalendarOptIn: !isTestimonialTarget,
        greeting: 'Hello {{.RecipientName}},',
      });
      const mergedHTML = customHtmlBody.trim() || builtHtml;
      const textBody = buildFormEmailTextBody({
        title: form.title || 'Registration',
        heading: heading.trim(),
        message: message.trim(),
      });
      const htmlBody = embedTemplateMeta(
        mergedHTML,
        {
          heading: heading.trim(),
          message: message.trim(),
          logoUrl: nextLogoUrl || undefined,
          imageUrl: nextImageUrl || undefined,
          customHtml: mergedHTML,
        }
      );

      let savedTemplate: EmailTemplate;
      if (template) {
        savedTemplate = await apiClient.updateAdminEmailTemplate(template.id, {
          templateKey,
          ownerType: 'form',
          ownerId: form.id,
          subject: subject.trim(),
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
      setLogoUrl(nextLogoUrl);
      setImageUrl(nextImageUrl);
      setLogoFile(null);
      setImageFile(null);
      setLogoPreview(null);
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
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-solid border-primary-600 border-r-transparent" />
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

      <Card>
        <div className="grid gap-4 md:grid-cols-2">
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
            helperText="This key is used for this form's unique response template."
          />
          <Input
            label="Email heading"
            value={heading}
            onChange={(e) => setHeading(e.target.value)}
            placeholder="Registration Confirmed"
          />
          <Input
            label="Logo URL (optional)"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://.../logo.png"
          />
          <Input
            label="Template image URL (optional)"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://.../hero.png"
          />
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[var(--color-text-secondary)]">Upload logo (optional)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleLogoFile(e.target.files?.[0])}
              className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm"
            />
            <p className="text-xs text-[var(--color-text-tertiary)]">
              Max {MAX_EMAIL_IMAGE_MB}MB. JPEG, PNG, WebP.
            </p>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[var(--color-text-secondary)]">Upload template image (optional)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleImageFile(e.target.files?.[0])}
              className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm"
            />
            <p className="text-xs text-[var(--color-text-tertiary)]">
              Max {MAX_EMAIL_IMAGE_MB}MB. JPEG, PNG, WebP.
            </p>
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="block text-sm font-medium text-[var(--color-text-secondary)]">Email body message</label>
            <textarea
              className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] focus:ring-offset-2"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Thank you for registering. We look forward to hosting you."
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="block text-sm font-medium text-[var(--color-text-secondary)]">Custom HTML template (optional)</label>
            <textarea
              className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 font-mono text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] focus:ring-offset-2"
              rows={10}
              value={customHtmlBody}
              onChange={(e) => setCustomHtmlBody(e.target.value)}
              placeholder="Paste full HTML for complete control. Supported placeholders: {{.RecipientName}}, {{.RegistrationCode}}, {{.SubscribeURL}}, {{.UnsubscribeURL}}, {{.CalendarOptInURL}}."
            />
            <p className="text-xs text-[var(--color-text-tertiary)]">
              Leave empty to use the structured editor.
            </p>
          </div>

          <div className="md:col-span-2 rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)]">
              <Upload className="h-4 w-4" />
              Template Preview
            </div>
            <div className="mt-3 overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-white">
              <iframe title="email-preview" srcDoc={previewHTML} className="h-[520px] w-full" />
            </div>
            <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">
              The preview uses sample values for name{isTestimonialTarget ? '.' : ' and registration number.'}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default withAuth(ResponseEmailEditorPage);
