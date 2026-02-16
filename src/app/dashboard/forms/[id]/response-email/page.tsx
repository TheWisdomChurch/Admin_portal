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
import type { AdminForm, EmailTemplate, UpdateFormRequest } from '@/lib/types';
import { getServerErrorMessage } from '@/lib/serverValidation';

const MAX_IMAGE_MB = 5;
const MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const META_PREFIX = '<!--WH_FORM_TEMPLATE_META:';
const META_SUFFIX = '-->';

type TemplateMeta = {
  heading?: string;
  message?: string;
  logoUrl?: string;
  imageUrl?: string;
};

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripTemplateMeta(html: string) {
  return html.replace(/<!--WH_FORM_TEMPLATE_META:[\s\S]*?-->\s*/g, '');
}

function embedTemplateMeta(html: string, meta: TemplateMeta) {
  const payload = encodeURIComponent(JSON.stringify(meta));
  return `${META_PREFIX}${payload}${META_SUFFIX}\n${stripTemplateMeta(html)}`;
}

function parseTemplateMeta(html: string): TemplateMeta | null {
  const match = html.match(/<!--WH_FORM_TEMPLATE_META:([\s\S]*?)-->/);
  if (!match?.[1]) return null;
  try {
    const decoded = decodeURIComponent(match[1]);
    const parsed = JSON.parse(decoded) as TemplateMeta;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function buildResponseEmailHTML(opts: {
  title: string;
  heading: string;
  message: string;
  logoUrl?: string;
  imageUrl?: string;
}) {
  const safeTitle = escapeHtml(opts.title || 'Registration');
  const safeHeading = escapeHtml(opts.heading || 'Registration Confirmed');
  const safeMessage = escapeHtml(opts.message || 'Thank you for registering.');
  const safeLogoUrl = opts.logoUrl ? escapeHtml(opts.logoUrl) : '';
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
                ${safeLogoUrl ? `<img src="${safeLogoUrl}" alt="Logo" style="display:block;max-width:140px;height:auto;margin:0 0 14px 0;" />` : ''}
                <p style="margin:0 0 8px 0;font-size:13px;color:#6b7280;">${safeTitle}</p>
                <h2 style="margin:0;font-size:24px;line-height:1.25;color:#111827;">${safeHeading}</h2>
              </td>
            </tr>
            ${safeImageUrl ? `<tr><td style="padding:10px 24px 0 24px;"><img src="${safeImageUrl}" alt="${safeTitle}" style="display:block;width:100%;height:auto;border-radius:10px;" /></td></tr>` : ''}
            <tr>
              <td style="padding:18px 24px 12px 24px;">
                <p style="margin:0 0 14px 0;font-size:16px;color:#111827;">Hello {{.RecipientName}},</p>
                <p style="margin:0;font-size:15px;line-height:1.7;color:#374151;">${safeMessage}</p>
                {{if .RegistrationCode}}
                <div style="margin-top:16px;display:inline-block;padding:10px 14px;border-radius:8px;background:#f3f4f6;border:1px solid #e5e7eb;font-size:13px;color:#111827;">
                  Registration Number: <strong>{{.RegistrationCode}}</strong>
                </div>
                {{end}}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`.trim();
}

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

  const templateKeyPreview = useMemo(() => {
    const existing = form?.settings?.responseEmailTemplateKey?.trim();
    if (existing) return existing;
    if (form?.slug) return `forms/${form.slug}`;
    if (form?.title) return `forms/${normalizeSlug(form.title)}`;
    if (form?.id) return `forms/${form.id}`;
    return '';
  }, [form]);

  const previewHTML = useMemo(() => {
    const raw = buildResponseEmailHTML({
      title: form?.title || 'Registration',
      heading,
      message,
      logoUrl: logoPreview || logoUrl,
      imageUrl: imagePreview || imageUrl,
    });
    return raw
      .replace(/{{if \.RegistrationCode}}/g, '')
      .replace(/{{end}}/g, '')
      .replace(/{{\.RecipientName}}/g, 'John Doe')
      .replace(/{{\.RegistrationCode}}/g, 'REG-WPC-0001');
  }, [form?.title, heading, message, logoPreview, logoUrl, imagePreview, imageUrl]);

  const validateImageFile = (file: File): string | null => {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      return 'Image must be JPEG, PNG, or WebP.';
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return `Image must be ${MAX_IMAGE_MB}MB or smaller.`;
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
      setLogoFile(null);
      setLogoPreview(null);
      return;
    }
    const err = validateImageFile(file);
    if (err) {
      toast.error(err);
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleImageFile = (file?: File) => {
    if (!file) {
      setImageFile(null);
      setImagePreview(null);
      return;
    }
    const err = validateImageFile(file);
    if (err) {
      toast.error(err);
      return;
    }
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
      let nextLogoUrl = logoUrl.trim();
      let nextImageUrl = imageUrl.trim();

      if (logoFile) {
        const uploaded = await apiClient.uploadImage(logoFile, 'email_template');
        nextLogoUrl = uploaded.url;
      }
      if (imageFile) {
        const uploaded = await apiClient.uploadImage(imageFile, 'email_template');
        nextImageUrl = uploaded.url;
      }

      const templateKey = templateKeyPreview || `forms/${form.id}`;
      const htmlBody = embedTemplateMeta(
        buildResponseEmailHTML({
          title: form.title || 'Registration',
          heading: heading.trim(),
          message: message.trim(),
          logoUrl: nextLogoUrl || undefined,
          imageUrl: nextImageUrl || undefined,
        }),
        {
          heading: heading.trim(),
          message: message.trim(),
          logoUrl: nextLogoUrl || undefined,
          imageUrl: nextImageUrl || undefined,
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
            <p className="text-xs text-[var(--color-text-tertiary)]">Max {MAX_IMAGE_MB}MB. JPEG, PNG, WebP.</p>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[var(--color-text-secondary)]">Upload template image (optional)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleImageFile(e.target.files?.[0])}
              className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm"
            />
            <p className="text-xs text-[var(--color-text-tertiary)]">Max {MAX_IMAGE_MB}MB. JPEG, PNG, WebP.</p>
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

          <div className="md:col-span-2 rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)]">
              <Upload className="h-4 w-4" />
              Template Preview
            </div>
            <div className="mt-3 overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-white">
              <iframe title="email-preview" srcDoc={previewHTML} className="h-[520px] w-full" />
            </div>
            <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">
              The preview uses sample values for name and registration number.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default withAuth(ResponseEmailEditorPage);
