'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { ArrowLeft, Copy, Download, Save, Send } from 'lucide-react';

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
  type StoredFormEmailTemplateMeta,
} from '@/lib/formEmailTemplates';
import {
  exportFormCampaignRecipientsCsv,
  extractFormCampaignRecipients,
  fetchAllFormSubmissions,
  resolveFormSubmissionEmail,
  type FormCampaignRecipient,
} from '@/lib/formSubmissions';
import { buildPublicFormUrl } from '@/lib/utils';
import type { AdminForm, EmailTemplate, FormSubmission, UpdateFormRequest } from '@/lib/types';
import { getServerErrorMessage } from '@/lib/serverValidation';

type AudienceStats = {
  totalSubmissions: number;
  submissionsWithValidEmail: number;
  uniqueRecipients: number;
  duplicateEmails: number;
  missingOrInvalidEmail: number;
};

function buildAudienceStats(
  submissions: FormSubmission[],
  recipients: FormCampaignRecipient[]
): AudienceStats {
  const submissionsWithValidEmail = submissions.filter((submission) => {
    const email = resolveFormSubmissionEmail(submission);
    return Boolean(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  }).length;

  return {
    totalSubmissions: submissions.length,
    submissionsWithValidEmail,
    uniqueRecipients: recipients.length,
    duplicateEmails: Math.max(0, submissionsWithValidEmail - recipients.length),
    missingOrInvalidEmail: Math.max(0, submissions.length - submissionsWithValidEmail),
  };
}

function validateImageFile(file: File): string | null {
  if (!ACCEPTED_EMAIL_IMAGE_TYPES.includes(file.type)) {
    return 'Image must be JPEG, PNG, or WebP.';
  }
  if (file.size > MAX_EMAIL_IMAGE_BYTES) {
    return `Image must be ${MAX_EMAIL_IMAGE_MB}MB or smaller.`;
  }
  return null;
}

function RegistrantCampaignPage() {
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
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);

  const [subject, setSubject] = useState('');
  const [heading, setHeading] = useState('A special update for our registered guests');
  const [message, setMessage] = useState(
    'Thank you for registering. We are sharing this update so you have the latest details, announcements, and event resources before the day.'
  );
  const [logoUrl, setLogoUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [ctaLabel, setCtaLabel] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [customHtmlBody, setCustomHtmlBody] = useState('');

  const recipients = useMemo(() => extractFormCampaignRecipients(submissions), [submissions]);
  const audienceStats = useMemo(() => buildAudienceStats(submissions, recipients), [submissions, recipients]);
  const latestRecipients = useMemo(() => recipients.slice(0, 8), [recipients]);

  const templateKeyPreview = useMemo(() => {
    const existing = form?.settings?.campaignEmailTemplateKey?.trim();
    if (existing) return existing;
    if (form?.slug) return `forms/${form.slug}/campaigns/primary`;
    if (form?.title) return `forms/${normalizeTemplateSlug(form.title)}/campaigns/primary`;
    if (form?.id) return `forms/${form.id}/campaigns/primary`;
    return '';
  }, [form]);

  const generatedHtml = useMemo(() => {
    return buildFormEmailHTML({
      title: form?.title || 'Registrant Outreach',
      heading,
      message,
      logoUrl: logoPreview || logoUrl || undefined,
      imageUrl: imagePreview || imageUrl || undefined,
      ctaLabel: ctaLabel.trim() || undefined,
      ctaUrl: ctaUrl.trim() || undefined,
      includeRegistrationCode: true,
      includeCalendarOptIn: false,
      greeting: 'Hello {{.RecipientName}},',
    });
  }, [ctaLabel, ctaUrl, form?.title, heading, imagePreview, imageUrl, logoPreview, logoUrl, message]);

  const generatedText = useMemo(() => {
    return buildFormEmailTextBody({
      title: form?.title || 'Registrant Outreach',
      heading,
      message,
      ctaLabel: ctaLabel.trim() || undefined,
      ctaUrl: ctaUrl.trim() || undefined,
    });
  }, [ctaLabel, ctaUrl, form?.title, heading, message]);

  const activeHtmlBody = useMemo(() => customHtmlBody.trim() || generatedHtml, [customHtmlBody, generatedHtml]);

  const previewHTML = useMemo(() => toEmailPreview(activeHtmlBody), [activeHtmlBody]);

  const campaignHtmlFilename = useMemo(() => {
    const label = form?.slug || form?.title || form?.id || 'registrant-outreach';
    return `${normalizeTemplateSlug(label)}-campaign.html`;
  }, [form?.id, form?.slug, form?.title]);

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
        const [loadedForm, allSubmissions, templatesResponse] = await Promise.all([
          apiClient.getAdminForm(formId),
          fetchAllFormSubmissions(formId),
          apiClient.listAdminEmailTemplates({
            page: 1,
            limit: 50,
            ownerType: 'form_campaign',
            ownerId: formId,
          }),
        ]);

        setForm(loadedForm);
        setSubmissions(allSubmissions);

        const subjectFallback =
          loadedForm.settings?.campaignEmailSubject?.trim() || `Update for ${loadedForm.title}`;
        setSubject(subjectFallback);
        setImageUrl(loadedForm.settings?.campaignEmailTemplateUrl?.trim() || '');
        setCtaUrl(buildPublicFormUrl(loadedForm.slug, loadedForm.publicUrl) || '');

        const active = templatesResponse.data.find((item) => item.isActive);
        const latest = [...templatesResponse.data].sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1))[0];
        const tpl = active || latest || null;

        if (tpl) {
          setTemplate(tpl);
          if (tpl.subject?.trim()) setSubject(tpl.subject.trim());
          const meta = parseTemplateMeta(tpl.htmlBody);
          if (meta?.heading) setHeading(meta.heading);
          if (meta?.message) setMessage(meta.message);
          if (meta?.logoUrl) setLogoUrl(meta.logoUrl);
          if (meta?.imageUrl) setImageUrl(meta.imageUrl);
          if (meta?.ctaLabel) setCtaLabel(meta.ctaLabel);
          if (meta?.ctaUrl) setCtaUrl(meta.ctaUrl);
          if (meta?.customHtml) setCustomHtmlBody(stripTemplateMeta(meta.customHtml));
          else setCustomHtmlBody(stripTemplateMeta(tpl.htmlBody));
        }
      } catch (err) {
        toast.error(getServerErrorMessage(err, 'Failed to load registrant outreach setup.'));
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
    if (recipients.length === 0) {
      toast.error('No valid recipient emails were found for this form yet.');
      return;
    }

    setSaving(true);
    try {
      let nextLogoUrl = normalizeAbsoluteHttpUrl(logoUrl);
      let nextImageUrl = normalizeAbsoluteHttpUrl(imageUrl);
      let nextCtaUrl = normalizeAbsoluteHttpUrl(ctaUrl);

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
      if (ctaUrl.trim() && !nextCtaUrl) {
        toast.error('CTA URL is invalid. Use a full URL like https://...');
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

      const templateKey = templateKeyPreview || `forms/${form.id}/campaigns/primary`;
      const builtHtml = buildFormEmailHTML({
        title: form.title || 'Registrant Outreach',
        heading: heading.trim(),
        message: message.trim(),
        logoUrl: nextLogoUrl || undefined,
        imageUrl: nextImageUrl || undefined,
        ctaLabel: ctaLabel.trim() || undefined,
        ctaUrl: nextCtaUrl || undefined,
        includeRegistrationCode: true,
        includeCalendarOptIn: false,
        greeting: 'Hello {{.RecipientName}},',
      });
      const mergedHTML = customHtmlBody.trim() || builtHtml;
      const htmlBody = embedTemplateMeta(mergedHTML, {
        heading: heading.trim(),
        message: message.trim(),
        logoUrl: nextLogoUrl || undefined,
        imageUrl: nextImageUrl || undefined,
        ctaLabel: ctaLabel.trim() || undefined,
        ctaUrl: nextCtaUrl || undefined,
        customHtml: mergedHTML,
      } satisfies StoredFormEmailTemplateMeta);
      const textBody = buildFormEmailTextBody({
        title: form.title || 'Registrant Outreach',
        heading: heading.trim(),
        message: message.trim(),
        ctaLabel: ctaLabel.trim() || undefined,
        ctaUrl: nextCtaUrl || undefined,
      });

      let savedTemplate: EmailTemplate;
      if (template) {
        savedTemplate = await apiClient.updateAdminEmailTemplate(template.id, {
          templateKey,
          ownerType: 'form_campaign',
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
          ownerType: 'form_campaign',
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
          campaignEmailEnabled: true,
          campaignEmailSubject: subject.trim() || undefined,
          campaignEmailTemplateId: savedTemplate.id,
          campaignEmailTemplateKey: templateKey,
          campaignEmailTemplateUrl: nextImageUrl || undefined,
        },
      };
      const updatedForm = await apiClient.updateAdminForm(form.id, settingsUpdate);

      setForm(updatedForm);
      setTemplate(savedTemplate);
      setLogoUrl(nextLogoUrl);
      setImageUrl(nextImageUrl);
      setCtaUrl(nextCtaUrl);
      setLogoFile(null);
      setImageFile(null);
      setLogoPreview(null);
      setImagePreview(null);

      toast.success('Registrant outreach template saved.');
    } catch (err) {
      toast.error(getServerErrorMessage(err, 'Failed to save outreach template.'));
    } finally {
      setSaving(false);
    }
  };

  const copyCampaignHtml = async () => {
    try {
      await navigator.clipboard.writeText(activeHtmlBody);
      toast.success('Campaign HTML copied.');
    } catch {
      toast.error('Failed to copy campaign HTML.');
    }
  };

  const copyCampaignText = async () => {
    try {
      await navigator.clipboard.writeText(generatedText);
      toast.success('Campaign text copied.');
    } catch {
      toast.error('Failed to copy campaign text.');
    }
  };

  const downloadCampaignHtml = () => {
    const blob = new Blob([activeHtmlBody], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = campaignHtmlFilename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    toast.success('Campaign HTML downloaded.');
  };

  const copyAudienceEmails = async () => {
    if (recipients.length === 0) {
      toast.error('No valid recipient emails found.');
      return;
    }

    try {
      await navigator.clipboard.writeText(recipients.map((recipient) => recipient.email).join(', '));
      toast.success('Recipient emails copied.');
    } catch {
      toast.error('Failed to copy recipient emails.');
    }
  };

  const exportAudience = () => {
    if (!form || recipients.length === 0) {
      toast.error('No valid recipient emails found.');
      return;
    }
    exportFormCampaignRecipientsCsv(recipients, form.title || form.id);
    toast.success('Audience CSV exported.');
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
          title="Registrant Outreach"
          subtitle={`Create polished campaign emails for people who registered through ${form.title}.`}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/dashboard/forms/${form.id}/edit`)}
            icon={<ArrowLeft className="h-4 w-4" />}
          >
            Back to Form
          </Button>
          <Button variant="outline" onClick={copyAudienceEmails} icon={<Copy className="h-4 w-4" />}>
            Copy Audience
          </Button>
          <Button variant="outline" onClick={exportAudience} icon={<Download className="h-4 w-4" />}>
            Export Audience
          </Button>
          <Button onClick={saveTemplate} loading={saving} icon={<Save className="h-4 w-4" />}>
            Save Campaign
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">Submissions</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--color-text-primary)]">
            {audienceStats.totalSubmissions}
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">Valid email records</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--color-text-primary)]">
            {audienceStats.submissionsWithValidEmail}
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">Unique recipients</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--color-text-primary)]">
            {audienceStats.uniqueRecipients}
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">Duplicates or missing</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--color-text-primary)]">
            {audienceStats.duplicateEmails + audienceStats.missingOrInvalidEmail}
          </p>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <Card>
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Email subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Important update for registered guests"
              />
              <Input
                label="Template key"
                value={templateKeyPreview}
                disabled
                helperText="This key keeps the campaign template attached to this form."
              />
              <Input
                label="Campaign heading"
                value={heading}
                onChange={(e) => setHeading(e.target.value)}
                placeholder="Here is everything you need before the event"
              />
              <Input
                label="Logo URL (optional)"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://.../logo.png"
              />
              <Input
                label="Flyer / hero image URL (optional)"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://.../flyer.png"
              />
              <Input
                label="Call-to-action label (optional)"
                value={ctaLabel}
                onChange={(e) => setCtaLabel(e.target.value)}
                placeholder="View program details"
              />
              <Input
                label="Call-to-action URL (optional)"
                value={ctaUrl}
                onChange={(e) => setCtaUrl(e.target.value)}
                placeholder="https://your-domain.com/event-details"
                helperText="Use a full URL if you want a button inside the email."
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
                <label className="block text-sm font-medium text-[var(--color-text-secondary)]">Upload flyer / hero image (optional)</label>
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
                <label className="block text-sm font-medium text-[var(--color-text-secondary)]">Campaign message</label>
                <textarea
                  className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] focus:ring-offset-2"
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Thank you once again for registering. We are sharing this update so you have the correct arrival time, flyer, and final schedule."
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="block text-sm font-medium text-[var(--color-text-secondary)]">Custom HTML template (optional)</label>
                <textarea
                  className="w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 font-mono text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] focus:ring-offset-2"
                  rows={10}
                  value={customHtmlBody}
                  onChange={(e) => setCustomHtmlBody(e.target.value)}
                  placeholder="Paste full HTML for complete control. Supported placeholders: {{.RecipientName}}, {{.RegistrationCode}}, {{.SubscribeURL}}, {{.UnsubscribeURL}}"
                />
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  Leave empty to use the structured campaign editor.
                </p>
              </div>
            </div>
          </Card>

          <Card title="Campaign Delivery">
            <div className="space-y-3 text-sm text-[var(--color-text-secondary)]">
              <p>
                Your audience and campaign template are fully prepared here. Registrant emails are pulled directly from form submissions and deduplicated for outreach quality.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={copyCampaignHtml} icon={<Copy className="h-4 w-4" />}>
                  Copy HTML
                </Button>
                <Button variant="outline" onClick={copyCampaignText} icon={<Copy className="h-4 w-4" />}>
                  Copy Text
                </Button>
                <Button variant="outline" onClick={downloadCampaignHtml} icon={<Download className="h-4 w-4" />}>
                  Download HTML
                </Button>
              </div>
              <div className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)]">
                  <Send className="h-4 w-4" />
                  Delivery integration status
                </div>
                <p className="mt-2 text-sm text-[var(--color-text-tertiary)]">
                  The current frontend API exposes template saving and audience management, but it does not yet expose a segmented "send this campaign to this form audience" delivery endpoint. This page prepares the campaign professionally and keeps the audience ready for backend delivery wiring.
                </p>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Audience Snapshot">
            {latestRecipients.length > 0 ? (
              <div className="space-y-3">
                {latestRecipients.map((recipient) => (
                  <div
                    key={`${recipient.email}-${recipient.submissionId}`}
                    className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-4 py-3"
                  >
                    <div className="text-sm font-medium text-[var(--color-text-primary)]">{recipient.name}</div>
                    <div className="text-xs text-[var(--color-text-secondary)]">{recipient.email}</div>
                    <div className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                      {recipient.registrationCode ? `Reg: ${recipient.registrationCode} · ` : ''}
                      {new Date(recipient.submittedAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--color-text-tertiary)]">
                No valid email addresses have been captured from this form yet.
              </p>
            )}
          </Card>

          <Card title="Template Preview">
            <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-white">
              <iframe title="campaign-email-preview" srcDoc={previewHTML} className="h-[620px] w-full" />
            </div>
            <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">
              The preview uses sample recipient values and does not send any email.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default withAuth(RegistrantCampaignPage, { requiredRole: 'admin' });
