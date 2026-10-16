'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Check,
  Code2,
  Copy,
  Eye,
  FileCode2,
  LayoutTemplate,
  MailCheck,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react';

import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Input } from '@/ui/Input';
import { ConfirmationModal } from '@/ui/ConfirmationModal';
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
  toPlainText,
} from '@/lib/forms/formEmailTemplates';
import type { AdminForm, EmailTemplate, FormEmailContent, UpdateFormRequest } from '@/lib/types';
import { getServerErrorMessage } from '@/lib/serverValidation';

// A small debounce so the live preview doesn't fire a network request on
// every keystroke — it still calls the backend's real render path
// (apiClient.previewAdminEmailTemplate), just not on every character typed.
const PREVIEW_DEBOUNCE_MS = 400;

interface PersonalizationTag {
  tag: string;
  label: string;
  desc: string;
  highlight?: boolean;
}

const PERSONALIZATION_TAGS: PersonalizationTag[] = [
  { tag: '{{FirstName}}', label: 'First Name', desc: 'Recipient first name' },
  { tag: '{{RecipientName}}', label: 'Full Name', desc: 'Full recipient name' },
  {
    tag: '{{AttendingFlyerURL}}',
    label: 'Attendee DP Link',
    desc: 'Personalized status flyer link for attendee (/forms/[slug]/dp?name=...)',
    highlight: true,
  },
  {
    tag: '{{AttendingBadgeURL}}',
    label: 'Attendee Badge Link',
    desc: 'Alias for Attendee DP link',
    highlight: true,
  },
  { tag: '{{FormTitle}}', label: 'Program Title', desc: 'Name of the program' },
  { tag: '{{RegistrationCode}}', label: 'Reg. Code', desc: 'Unique confirmation code' },
  { tag: '{{EventDate}}', label: 'Date', desc: 'Event date' },
  { tag: '{{EventTime}}', label: 'Time', desc: 'Event time' },
  { tag: '{{EventLocation}}', label: 'Venue', desc: 'Event location' },
  { tag: '{{CalendarOptInURL}}', label: 'Calendar Link', desc: 'Link to add event to calendar' },
  { tag: '{{SubscribeURL}}', label: 'Subscribe URL', desc: 'Subscription link' },
  { tag: '{{UnsubscribeURL}}', label: 'Unsubscribe URL', desc: 'Unsubscribe link' },
];

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

  // Editor mode: 'structured' uses the default template builder fields;
  // 'custom_html' gives the user direct, full-control HTML editing.
  const [editorMode, setEditorMode] = useState<'structured' | 'custom_html'>('structured');

  const [responseEmailEnabled, setResponseEmailEnabled] = useState(true);
  const [subject, setSubject] = useState('');
  const [eyebrow, setEyebrow] = useState('');
  const [heading, setHeading] = useState('Registration Confirmed');
  const [message, setMessage] = useState('Thank you for registering. Your details have been received successfully.');
  const [imageUrl, setImageUrl] = useState('');
  const [spotlightLabel, setSpotlightLabel] = useState('');
  const [spotlightText, setSpotlightText] = useState('');
  const [nextStepsHeading, setNextStepsHeading] = useState('');
  const [nextStepsText, setNextStepsText] = useState('');
  const [ctaLabel, setCtaLabel] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');
  const [closingMessage, setClosingMessage] = useState('');
  const [signOff, setSignOff] = useState('With love,');

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [customHtmlBody, setCustomHtmlBody] = useState('');
  const [previewMode, setPreviewMode] = useState<'rendered' | 'html'>('rendered');

  // Holds raw HTML returned by the backend for structured mode
  const [rawStructuredHtml, setRawStructuredHtml] = useState('');
  const [renderedPreviewHTML, setRenderedPreviewHTML] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  const [copied, setCopied] = useState(false);
  const [revertModalOpen, setRevertModalOpen] = useState(false);

  const leftHtmlEditorRef = useRef<HTMLTextAreaElement>(null);
  const rightHtmlEditorRef = useRef<HTMLTextAreaElement>(null);

  const isTestimonialForm = useMemo(() => {
    const target = form?.settings?.submissionTarget?.trim().toLowerCase() || '';
    const formType = form?.settings?.formType?.trim().toLowerCase() || '';
    const slug = form?.slug?.toLowerCase() || '';
    const title = form?.title?.toLowerCase() || '';
    return (
      target === 'testimonial' ||
      formType === 'testimonial' ||
      slug.includes('testimon') ||
      title.includes('testimon')
    );
  }, [form]);

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

  // The structured content sent to (and rendered by) the backend.
  const structuredContent = useMemo<FormEmailContent>(() => ({
    eyebrow: eyebrow.trim() || undefined,
    heading: heading.trim(),
    message: message.trim(),
    imageUrl: (imagePreview || imageUrl || '').trim() || undefined,
    spotlightLabel: spotlightLabel.trim() || undefined,
    spotlightText: spotlightText.trim() || undefined,
    nextStepsHeading: nextStepsHeading.trim() || undefined,
    nextStepsText: nextStepsText.trim() || undefined,
    ctaLabel: ctaLabel.trim() || undefined,
    ctaUrl: ctaUrl.trim() || undefined,
    closingMessage: closingMessage.trim() || undefined,
    signOff: closingMessage.trim() ? (signOff.trim() || undefined) : undefined,
    includeRegistrationCode: includeRegistrationArtifacts,
    includeCalendarOptIn: includeRegistrationArtifacts,
  }), [
    closingMessage,
    ctaLabel,
    ctaUrl,
    eyebrow,
    heading,
    imagePreview,
    imageUrl,
    includeRegistrationArtifacts,
    message,
    nextStepsHeading,
    nextStepsText,
    signOff,
    spotlightLabel,
    spotlightText,
  ]);

  const usingCustomHtml = editorMode === 'custom_html' || customHtmlBody.trim().length > 0;

  useEffect(() => {
    if (usingCustomHtml) return;

    let cancelled = false;
    setPreviewLoading(true);
    const timer = setTimeout(() => {
      apiClient
        .previewAdminEmailTemplate(structuredContent)
        .then((res) => {
          if (!cancelled) {
            setRawStructuredHtml(res.htmlBody);
            setRenderedPreviewHTML(toEmailPreview(res.htmlBody));
          }
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
  const currentHtmlValue = usingCustomHtml ? customHtmlBody : (rawStructuredHtml || renderedPreviewHTML);

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
        const slug = loadedForm.slug?.toLowerCase() || '';
        const title = loadedForm.title?.toLowerCase() || '';
        const isTestimonial =
          target === 'testimonial' ||
          formType === 'testimonial' ||
          slug.includes('testimon') ||
          title.includes('testimon');

        if (typeof loadedForm.settings?.responseEmailEnabled === 'boolean') {
          setResponseEmailEnabled(loadedForm.settings.responseEmailEnabled);
        } else if (isTestimonial) {
          setResponseEmailEnabled(false);
        } else {
          setResponseEmailEnabled(true);
        }

        const supportsRegistrationArtifacts =
          !isTestimonial &&
          target !== 'member' &&
          target !== 'leadership' &&
          (formType === 'event' || formType === 'registration' || formType === 'workforce');
        const subjectPrefix = isTestimonial
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
            if (tpl.content.eyebrow) setEyebrow(tpl.content.eyebrow);
            if (tpl.content.heading) setHeading(tpl.content.heading);
            if (tpl.content.message) setMessage(tpl.content.message);
            if (tpl.content.imageUrl) setImageUrl(tpl.content.imageUrl);
            if (tpl.content.spotlightLabel) setSpotlightLabel(tpl.content.spotlightLabel);
            if (tpl.content.spotlightText) setSpotlightText(tpl.content.spotlightText);
            if (tpl.content.nextStepsHeading) setNextStepsHeading(tpl.content.nextStepsHeading);
            if (tpl.content.nextStepsText) setNextStepsText(tpl.content.nextStepsText);
            if (tpl.content.ctaLabel) setCtaLabel(tpl.content.ctaLabel);
            if (tpl.content.ctaUrl) setCtaUrl(tpl.content.ctaUrl);
            if (tpl.content.closingMessage) setClosingMessage(tpl.content.closingMessage);
            if (tpl.content.signOff) setSignOff(tpl.content.signOff);
            setEditorMode('structured');
          } else {
            // Saved as custom HTML template or legacy template.
            const meta = parseTemplateMeta(tpl.htmlBody);
            if (meta?.heading) setHeading(meta.heading);
            if (meta?.message) setMessage(meta.message);
            if (meta?.imageUrl) setImageUrl(meta.imageUrl);
            setCustomHtmlBody(tpl.htmlBody);
            setEditorMode('custom_html');
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

  const handleHtmlChange = (newVal: string) => {
    setCustomHtmlBody(newVal);
    if (editorMode !== 'custom_html') {
      setEditorMode('custom_html');
    }
  };

  const handleLoadStructuredHtml = () => {
    const sourceHtml = rawStructuredHtml || renderedPreviewHTML;
    if (!sourceHtml) {
      toast.error('Default template markup is still rendering. Please wait a moment.');
      return;
    }
    setCustomHtmlBody(sourceHtml);
    setEditorMode('custom_html');
    toast.success('Default template HTML loaded into editor.');
  };

  const handleStartBlankHtml = () => {
    const title = form?.title || 'Registration';
    const blankHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; color: #111827; }
    .email-container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #e5e7eb; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    h1 { font-size: 24px; font-weight: 800; margin: 0 0 16px 0; color: #111827; }
    p { font-size: 15px; line-height: 1.7; color: #374151; margin: 0 0 16px 0; }
    .badge-box { display: inline-block; padding: 10px 16px; border-radius: 8px; background: #fffbeb; border: 1px solid #fde68a; font-size: 14px; font-weight: 600; color: #92400e; margin: 8px 0 20px 0; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; text-align: center; }
  </style>
</head>
<body>
  <div class="email-container">
    <h1>Thank you for registering, {{FirstName}}!</h1>
    <p>Your registration for <strong>{{FormTitle}}</strong> has been received successfully.</p>
    <div class="badge-box">
      Confirmation Code: <strong>{{RegistrationCode}}</strong>
    </div>
    <p>We look forward to hosting you at <strong>{{EventLocation}}</strong>.</p>
    <div class="footer">
      <p>&copy; Wisdom Church. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
    setCustomHtmlBody(blankHtml);
    setEditorMode('custom_html');
    toast.success('Clean blank HTML starter loaded into editor.');
  };

  const handleRevertToStructured = () => {
    setCustomHtmlBody('');
    setEditorMode('structured');
    setRevertModalOpen(false);
    toast.success('Reverted to default structured builder.');
  };

  const handleCopyHtml = async (textToCopy: string) => {
    if (!textToCopy) return;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      toast.success('HTML copied to clipboard.');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy to clipboard.');
    }
  };

  const insertTag = (tag: string, targetRef: React.RefObject<HTMLTextAreaElement | null>) => {
    const textarea = targetRef.current;
    if (textarea) {
      const start = textarea.selectionStart ?? 0;
      const end = textarea.selectionEnd ?? 0;
      const base = customHtmlBody || rawStructuredHtml || renderedPreviewHTML;
      const updated = base.substring(0, start) + tag + base.substring(end);
      setCustomHtmlBody(updated);
      if (editorMode !== 'custom_html') setEditorMode('custom_html');
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + tag.length, start + tag.length);
      }, 0);
    } else {
      setCustomHtmlBody((prev) => {
        const base = prev || rawStructuredHtml || renderedPreviewHTML;
        return base ? `${base} ${tag} ` : tag;
      });
      if (editorMode !== 'custom_html') setEditorMode('custom_html');
    }
    toast.success(`Inserted ${tag}`);
  };

  const insertSnippet = (snippet: string, targetRef: React.RefObject<HTMLTextAreaElement | null>) => {
    const textarea = targetRef.current;
    if (textarea) {
      const start = textarea.selectionStart ?? 0;
      const end = textarea.selectionEnd ?? 0;
      const base = customHtmlBody || rawStructuredHtml || renderedPreviewHTML;
      const updated = base.substring(0, start) + snippet + base.substring(end);
      setCustomHtmlBody(updated);
      if (editorMode !== 'custom_html') setEditorMode('custom_html');
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + snippet.length, start + snippet.length);
      }, 0);
    } else {
      setCustomHtmlBody((prev) => {
        const base = prev || rawStructuredHtml || renderedPreviewHTML;
        return base ? `${base}\n${snippet}\n` : snippet;
      });
      if (editorMode !== 'custom_html') setEditorMode('custom_html');
    }
  };

  const handleInsertDpButton = (targetRef: React.RefObject<HTMLTextAreaElement | null>) => {
    const snippet = `
<!-- Attendee DP / Status Flyer Button -->
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto;">
  <tr>
    <td style="background:#92400e;border-radius:8px;text-align:center;">
      <a href="{{AttendingFlyerURL}}" style="display:inline-block;padding:12px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.02em;">
        ✨ Generate My Attendee DP
      </a>
    </td>
  </tr>
</table>
`;
    insertSnippet(snippet, targetRef);
    toast.success('Inserted Attendee DP Button markup.');
  };

  const handleSetDpAsCta = () => {
    setCtaLabel('✨ Generate My Attendee DP');
    setCtaUrl('{{AttendingFlyerURL}}');
    if (!nextStepsHeading.trim()) {
      setNextStepsHeading('Get Your Attendee DP Flyer');
    }
    if (!nextStepsText.trim()) {
      setNextStepsText('Generate your personalized status flyer to share on WhatsApp, Instagram, and social media!');
    }
    toast.success('Configured Attendee DP button in What Happens Next section.');
  };

  const handleAppendDpToMessage = () => {
    setMessage((prev) => {
      const trimmed = prev.trimEnd();
      const dpSnippet = '\n\nGenerate your personalized attendee DP flyer here: {{AttendingFlyerURL}}';
      return trimmed ? `${trimmed}${dpSnippet}` : `Generate your personalized attendee DP flyer here: {{AttendingFlyerURL}}`;
    });
    toast.success('Added Attendee DP flyer link to message body.');
  };

  const saveTemplate = async () => {
    if (!form) return;
    if (!subject.trim()) {
      toast.error('Email subject is required.');
      return;
    }

    const isCustom = editorMode === 'custom_html' || usingCustomHtml;
    if (isCustom && !customHtmlBody.trim()) {
      toast.error('Please enter your custom HTML or click "Load Default Markup" to start from the current design.');
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

      const content: FormEmailContent | undefined = isCustom
        ? undefined
        : { ...structuredContent, imageUrl: nextImageUrl || undefined };
      const htmlBody = isCustom ? customHtmlBody.trim() : undefined;
      const textBody = isCustom
        ? toPlainText(customHtmlBody) || buildFormEmailTextBody({ title: form.title || 'Registration', heading: heading.trim(), message: message.trim() })
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

      const effectiveEmailEnabled = responseEmailEnabled;
      const settingsUpdate: UpdateFormRequest = {
        settings: {
          ...form.settings,
          responseEmailEnabled: effectiveEmailEnabled,
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

      toast.success(
        effectiveEmailEnabled
          ? isCustom
            ? 'Custom response email HTML template saved successfully.'
            : 'Response email template and settings saved.'
          : 'Response email settings saved (auto-response disabled).'
      );
    } catch (err) {
      toast.error(getServerErrorMessage(err, 'Failed to save response email template.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-75 w-full items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-solid border-(--color-accent-primary) border-r-transparent" />
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
        <div className="rounded-(--radius-card) border border-(--color-border-primary) bg-(--color-background-secondary) p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-(--color-text-tertiary)">Auto-Response Status</p>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${
                responseEmailEnabled
                  ? 'bg-emerald-500'
                  : 'bg-zinc-400'
              }`}
            />
            <p className="truncate text-base font-semibold text-(--color-text-primary)">
              {responseEmailEnabled
                ? 'Active / Dispatched'
                : 'Disabled'}
            </p>
          </div>
        </div>
        <div className="rounded-(--radius-card) border border-(--color-border-primary) bg-(--color-background-secondary) p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-(--color-text-tertiary)">Template Format</p>
          <p className="mt-2 text-base font-semibold text-(--color-text-primary)">
            {usingCustomHtml ? 'Custom HTML' : 'Standard Design'}
          </p>
        </div>
        <div className="rounded-(--radius-card) border border-(--color-border-primary) bg-(--color-background-secondary) p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-(--color-text-tertiary)">Form</p>
          <p className="mt-2 truncate text-base font-semibold text-(--color-text-primary)">{form.title}</p>
        </div>
        <div className="rounded-(--radius-card) border border-(--color-border-primary) bg-(--color-background-secondary) p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-(--color-text-tertiary)">Template Key</p>
          <p className="mt-2 truncate font-mono text-sm text-(--color-text-primary)">{templateKeyPreview || 'Not generated yet'}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(460px,0.9fr)]">
        {/* Left Column: Template Builder or Custom HTML Editor */}
        <Card
          title={
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between w-full">
              <span>{editorMode === 'custom_html' ? 'Custom HTML Editor' : 'Template Builder'}</span>
              <div className="flex rounded-lg border border-(--color-border-primary) bg-(--color-background-primary) p-0.5">
                <button
                  type="button"
                  onClick={() => {
                    if (usingCustomHtml && customHtmlBody.trim()) {
                      setRevertModalOpen(true);
                    } else {
                      setEditorMode('structured');
                    }
                  }}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                    editorMode === 'structured' && !customHtmlBody.trim()
                      ? 'bg-(--color-accent-primary) text-white shadow-sm'
                      : 'text-(--color-text-secondary) hover:text-(--color-text-primary)'
                  }`}
                >
                  <LayoutTemplate className="h-3.5 w-3.5" />
                  Default Settings
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditorMode('custom_html');
                    if (!customHtmlBody.trim() && (rawStructuredHtml || renderedPreviewHTML)) {
                      setCustomHtmlBody(rawStructuredHtml || renderedPreviewHTML);
                    }
                  }}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                    editorMode === 'custom_html' || customHtmlBody.trim()
                      ? 'bg-(--color-accent-primary) text-white shadow-sm'
                      : 'text-(--color-text-secondary) hover:text-(--color-text-primary)'
                  }`}
                >
                  <Code2 className="h-3.5 w-3.5" />
                  Custom HTML
                  {usingCustomHtml && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
                </button>
              </div>
            </div>
          }
          className="bg-(--color-background-secondary)"
          contentClassName="space-y-6"
        >
          {/* Form Auto-response toggle banner */}
          <div
            className={`rounded-(--radius-card) border p-4 transition-all ${
              responseEmailEnabled
                ? 'border-emerald-500/30 bg-emerald-500/5'
                : 'border-(--color-border-primary) bg-(--color-background-primary)'
            }`}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-(--color-text-primary)">
                  Dispatch Auto-Response Email on Submission
                </p>
                <p className="mt-1 text-xs text-(--color-text-tertiary)">
                  {isTestimonialForm
                    ? 'Testimonial forms default to disabled to respect submitter privacy, but you can enable auto-response if you want to automatically send a confirmation or thank-you email.'
                    : 'When enabled, submitters receive this branded confirmation email automatically. Turn off for internal process forms, silent staff workflows, or audit sheets.'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setResponseEmailEnabled(!responseEmailEnabled)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    responseEmailEnabled
                      ? 'bg-(--color-accent-primary)'
                      : 'bg-zinc-300 dark:bg-zinc-700'
                  }`}
                  aria-pressed={responseEmailEnabled}
                >
                  <span
                    aria-hidden="true"
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      responseEmailEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
                <span className="text-xs font-medium text-(--color-text-secondary)">
                  {responseEmailEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
          </div>

          {/* CUSTOM HTML MODE: Pure, unrestricted HTML editor */}
          {editorMode === 'custom_html' ? (
            <div className="space-y-5">
              <div className="rounded-(--radius-card) border border-amber-500/30 bg-amber-500/10 p-4">
                <div className="flex items-start gap-3">
                  <Code2 className="mt-0.5 h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                      Custom HTML Mode Active
                    </p>
                    <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-300">
                      Default response settings are bypassed. The response email will be dispatched using your exact HTML markup below. You have total creative and structural control.
                    </p>
                  </div>
                </div>
              </div>

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
              </section>

              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-(--radius-card) border border-(--color-border-primary) bg-(--color-background-primary) p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleLoadStructuredHtml}
                    icon={<RotateCcw className="h-3.5 w-3.5" />}
                  >
                    Load Default Markup
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleStartBlankHtml}
                    icon={<FileCode2 className="h-3.5 w-3.5" />}
                  >
                    Start Blank
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setRevertModalOpen(true)}
                    icon={<Trash2 className="h-3.5 w-3.5 text-rose-500" />}
                  >
                    Revert to Default Settings
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyHtml(customHtmlBody)}
                  icon={copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                >
                  {copied ? 'Copied' : 'Copy HTML'}
                </Button>
              </div>

              {/* Dedicated Attendee DP Flyer Inserter Card */}
              <div className="rounded-(--radius-card) border-2 border-dashed border-(--color-accent-primary)/40 bg-(--color-accent-surface)/50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-(--color-accent-primary)/15 p-2 text-(--color-accent-primary) shrink-0">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-(--color-text-primary)">
                          Personalized Attendee DP / Status Flyer Link
                        </p>
                        <span className="rounded-full bg-(--color-accent-primary)/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-(--color-accent-primary)">
                          {'{{AttendingFlyerURL}}'}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-(--color-text-secondary) leading-relaxed">
                        Attendees can generate and download their personalized flyer from this confirmation email.
                        Link route: <code className="font-mono text-[11px] text-(--color-text-primary)">/forms/{form?.slug || '[slug]'}/dp?name={'{{FirstName}}'}</code>
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      variant="primary"
                      onClick={() => handleInsertDpButton(leftHtmlEditorRef)}
                      icon={<Sparkles className="h-3.5 w-3.5" />}
                    >
                      Insert DP Button Markup
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => insertTag('{{AttendingFlyerURL}}', leftHtmlEditorRef)}
                    >
                      Insert Tag
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText('{{AttendingFlyerURL}}');
                        toast.success('Copied {{AttendingFlyerURL}} to clipboard');
                      }}
                      icon={<Copy className="h-3.5 w-3.5" />}
                    >
                      Copy Tag
                    </Button>
                  </div>
                </div>
              </div>

              {/* Quick dynamic tags inserter */}
              <div className="rounded-(--radius-card) border border-(--color-border-primary) bg-(--color-background-primary) p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-(--color-text-tertiary)">
                  Click tag to insert into HTML at cursor:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {PERSONALIZATION_TAGS.map((item) => (
                    <button
                      key={item.tag}
                      type="button"
                      onClick={() => insertTag(item.tag, leftHtmlEditorRef)}
                      title={item.desc}
                      className={`group inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-all active:scale-95 ${
                        item.highlight
                          ? 'border-(--color-accent-primary) bg-(--color-accent-surface) text-(--color-accent-primary) shadow-sm'
                          : 'border-(--color-border-primary) bg-(--color-background-secondary) text-(--color-text-primary) hover:border-(--color-accent-primary) hover:bg-(--color-accent-surface) hover:text-(--color-accent-primary)'
                      }`}
                    >
                      {item.highlight && <Sparkles className="h-3 w-3 text-(--color-accent-primary)" />}
                      <span className="font-mono text-[11px] font-semibold text-(--color-accent-primary)">{item.tag}</span>
                      <span className="text-[10px] text-(--color-text-tertiary) group-hover:text-(--color-accent-primary)">({item.label})</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* HTML Editor Textarea */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-semibold text-(--color-text-primary)">
                    Custom Email HTML Markup
                  </label>
                  <span className="text-xs text-(--color-text-tertiary)">
                    Changes reflect immediately in Live Preview
                  </span>
                </div>
                <textarea
                  ref={leftHtmlEditorRef}
                  className="h-130 w-full resize-y rounded-(--radius-card) border border-(--color-border-primary) bg-(--color-background-primary) p-4 font-mono text-xs leading-relaxed text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:outline-none focus:ring-2 focus:ring-(--color-border-focus) focus:ring-offset-2"
                  value={customHtmlBody}
                  onChange={(e) => handleHtmlChange(e.target.value)}
                  spellCheck={false}
                  placeholder="Paste or write your full HTML email markup here..."
                />
              </div>

              <div className="rounded-(--radius-card) border border-(--color-border-primary) bg-(--color-background-primary) p-4 text-xs space-y-2 text-(--color-text-tertiary)">
                <p className="font-semibold text-(--color-text-secondary)">Tips for custom email HTML:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Use inline CSS styles on tags (e.g., <code className="text-(--color-text-primary) font-mono">style=&quot;...&quot;</code>) for consistent display across Outlook, Gmail, and Apple Mail.</li>
                  <li>Include dynamic personalization tags like <code className="text-(--color-text-primary) font-mono">&#123;&#123;FirstName&#125;&#125;</code> and <code className="text-(--color-text-primary) font-mono">&#123;&#123;RegistrationCode&#125;&#125;</code> to personalize each submission response.</li>
                  <li>Check the live rendered appearance using the <strong>Rendered</strong> tab in the Live Preview panel on the right.</li>
                </ul>
              </div>
            </div>
          ) : (
            /* STRUCTURED DEFAULT BUILDER MODE */
            <div className="space-y-6">
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
                  label="Eyebrow (optional)"
                  value={eyebrow}
                  onChange={(e) => setEyebrow(e.target.value)}
                  placeholder="New Member Welcome"
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
                <div className="rounded-(--radius-button) border border-(--color-border-primary) bg-(--color-background-primary) p-3 md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-(--color-text-secondary)">Upload template image (optional)</label>
                  {/* eslint-disable-next-line no-restricted-syntax -- file input, styled with tokens */}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageFile(e.target.files?.[0])}
                    className="w-full rounded-(--radius-button) border border-(--color-border-primary) bg-(--color-background-secondary) px-3 py-2 text-sm"
                  />
                  <p className="mt-2 text-xs text-(--color-text-tertiary)">Max {MAX_EMAIL_IMAGE_MB}MB. JPEG, PNG, WebP.</p>
                </div>
              </section>

              {/* Dedicated Attendee DP Flyer Helper Card (Structured Mode) */}
              <div className="rounded-(--radius-card) border-2 border-dashed border-(--color-accent-primary)/40 bg-(--color-accent-surface)/50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-(--color-accent-primary)/15 p-2 text-(--color-accent-primary) shrink-0">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-(--color-text-primary)">
                          Personalized Attendee DP / Status Flyer Link
                        </p>
                        <span className="rounded-full bg-(--color-accent-primary)/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-(--color-accent-primary)">
                          {'{{AttendingFlyerURL}}'}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-(--color-text-secondary) leading-relaxed">
                        Each registered attendee receives a unique DP flyer link generated on submission.
                        Link route: <code className="font-mono text-[11px] text-(--color-text-primary)">/forms/{form?.slug || '[slug]'}/dp?name={'{{FirstName}}'}</code>
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      variant="primary"
                      onClick={handleSetDpAsCta}
                      icon={<Sparkles className="h-3.5 w-3.5" />}
                    >
                      Set as Action Button
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleAppendDpToMessage}
                    >
                      Add to Message
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText('{{AttendingFlyerURL}}');
                        toast.success('Copied {{AttendingFlyerURL}} to clipboard');
                      }}
                      icon={<Copy className="h-3.5 w-3.5" />}
                    >
                      Copy Tag
                    </Button>
                  </div>
                </div>
              </div>

              <section className="space-y-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <label className="block text-sm font-medium text-(--color-text-secondary)">Email body message</label>
                  <span className="text-xs text-(--color-text-tertiary)">Supports dynamic personalization tags</span>
                </div>

                {/* Quick 1-click dynamic personalization tag chips */}
                <div className="rounded-(--radius-card) border border-(--color-border-primary) bg-(--color-background-primary) p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-(--color-text-tertiary)">
                    Click tag to insert into message:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {PERSONALIZATION_TAGS.map((item) => (
                      <button
                        key={item.tag}
                        type="button"
                        onClick={() => {
                          setMessage((prev) => {
                            const trimmed = prev.trimEnd();
                            if (!trimmed) return item.tag + ' ';
                            return `${trimmed} ${item.tag} `;
                          });
                          toast.success(`Inserted ${item.tag}`);
                        }}
                        title={item.desc}
                        className={`group inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-all active:scale-95 ${
                          item.highlight
                            ? 'border-(--color-accent-primary) bg-(--color-accent-surface) text-(--color-accent-primary) shadow-sm'
                            : 'border-(--color-border-primary) bg-(--color-background-secondary) text-(--color-text-primary) hover:border-(--color-accent-primary) hover:bg-(--color-accent-surface) hover:text-(--color-accent-primary)'
                        }`}
                      >
                        {item.highlight && <Sparkles className="h-3 w-3 text-(--color-accent-primary)" />}
                        <span className="font-mono text-[11px] font-semibold text-(--color-accent-primary)">{item.tag}</span>
                        <span className="text-[10px] text-(--color-text-tertiary) group-hover:text-(--color-accent-primary)">({item.label})</span>
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  className="w-full rounded-(--radius-button) border border-(--color-border-primary) bg-(--color-background-primary) px-4 py-3 text-sm text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:outline-none focus:ring-2 focus:ring-(--color-border-focus) focus:ring-offset-2"
                  rows={7}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Thank you for registering. We look forward to hosting you."
                />
              </section>

              <section className="grid gap-4 md:grid-cols-2">
                <Input
                  label="Scripture / spotlight label (optional)"
                  value={spotlightLabel}
                  onChange={(e) => setSpotlightLabel(e.target.value)}
                  placeholder="Ephesians 2:19"
                />
                <div />
                <div className="md:col-span-2 space-y-2">
                  <label className="block text-sm font-medium text-(--color-text-secondary)">Scripture / spotlight text (optional)</label>
                  <textarea
                    className="w-full rounded-(--radius-button) border border-(--color-border-primary) bg-(--color-background-primary) px-4 py-3 text-sm text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:outline-none focus:ring-2 focus:ring-(--color-border-focus) focus:ring-offset-2"
                    rows={3}
                    value={spotlightText}
                    onChange={(e) => setSpotlightText(e.target.value)}
                    placeholder="Now therefore ye are no more strangers and foreigners..."
                  />
                  <p className="text-xs text-(--color-text-tertiary)">Renders as a highlighted callout box after the message.</p>
                </div>
              </section>

              <section className="grid gap-4 md:grid-cols-2">
                <Input
                  label="“What happens next” heading (optional)"
                  value={nextStepsHeading}
                  onChange={(e) => setNextStepsHeading(e.target.value)}
                  placeholder="What happens next?"
                />
                <div />
                <div className="md:col-span-2 space-y-2">
                  <label className="block text-sm font-medium text-(--color-text-secondary)">“What happens next” text (optional)</label>
                  <textarea
                    className="w-full rounded-(--radius-button) border border-(--color-border-primary) bg-(--color-background-primary) px-4 py-3 text-sm text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:outline-none focus:ring-2 focus:ring-(--color-border-focus) focus:ring-offset-2"
                    rows={4}
                    value={nextStepsText}
                    onChange={(e) => setNextStepsText(e.target.value)}
                    placeholder="Our team will follow up with you and share next steps."
                  />
                </div>
                <Input
                  label="Button label (optional)"
                  value={ctaLabel}
                  onChange={(e) => setCtaLabel(e.target.value)}
                  placeholder="View Upcoming Church Activities"
                />
                <div className="space-y-1">
                  <Input
                    label="Button link (optional)"
                    value={ctaUrl}
                    onChange={(e) => setCtaUrl(e.target.value)}
                    placeholder="https://... or {{AttendingFlyerURL}}"
                  />
                  <div className="flex items-center justify-between text-xs text-(--color-text-tertiary) pt-1">
                    <span>Target: URL or dynamic tag</span>
                    <button
                      type="button"
                      onClick={() => {
                        setCtaLabel('✨ Generate My Attendee DP');
                        setCtaUrl('{{AttendingFlyerURL}}');
                        if (!nextStepsHeading.trim()) setNextStepsHeading('Get Your Attendee DP Flyer');
                        toast.success('Set CTA button to Attendee DP Link');
                      }}
                      className="inline-flex items-center gap-1 font-semibold text-(--color-accent-primary) hover:underline"
                    >
                      <Sparkles className="h-3 w-3" />
                      Quick-fill Attendee DP ({"{{AttendingFlyerURL}}"})
                    </button>
                  </div>
                </div>
                <p className="md:col-span-2 text-xs text-(--color-text-tertiary)">The button renders inside the “What happens next” section.</p>
              </section>

              <section className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2 space-y-2">
                  <label className="block text-sm font-medium text-(--color-text-secondary)">Closing message (optional)</label>
                  <textarea
                    className="w-full rounded-(--radius-button) border border-(--color-border-primary) bg-(--color-background-primary) px-4 py-3 text-sm text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:outline-none focus:ring-2 focus:ring-(--color-border-focus) focus:ring-offset-2"
                    rows={3}
                    value={closingMessage}
                    onChange={(e) => setClosingMessage(e.target.value)}
                    placeholder="Once again, welcome. We are glad to have you as part of the family."
                  />
                </div>
                <Input
                  label="Sign-off"
                  value={signOff}
                  onChange={(e) => setSignOff(e.target.value)}
                  placeholder="With love,"
                  disabled={!closingMessage.trim()}
                />
              </section>

              {/* Callout to switch to Custom HTML */}
              <div className="rounded-(--radius-card) border border-(--color-border-primary) bg-(--color-background-primary) p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-(--color-text-primary)">
                    Need full HTML control instead?
                  </p>
                  <p className="text-xs text-(--color-text-tertiary)">
                    You can switch to Custom HTML mode to write or edit raw HTML without using these default response fields.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditorMode('custom_html');
                    if (!customHtmlBody.trim() && (rawStructuredHtml || renderedPreviewHTML)) {
                      setCustomHtmlBody(rawStructuredHtml || renderedPreviewHTML);
                    }
                  }}
                  icon={<Code2 className="h-4 w-4" />}
                >
                  Switch to Custom HTML
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Right Column: Live Preview & Directly Editable HTML Tab */}
        <Card
          title="Live Preview"
          className="bg-(--color-background-secondary) xl:sticky xl:top-24 h-fit"
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
                HTML Editor
              </Button>
            </div>
          }
          contentClassName="space-y-3"
        >
          <div className="flex items-center gap-2 rounded-(--radius-button) border border-(--color-border-secondary) bg-(--color-background-primary) px-3 py-2 text-xs text-(--color-text-tertiary)">
            <LayoutTemplate className="h-4 w-4 text-(--color-text-secondary)" />
            <span className="truncate">
              {usingCustomHtml
                ? 'Custom HTML mode is active. Live preview renders your edited markup.'
                : previewLoading
                  ? 'Rendering preview…'
                  : `Uses sample values for name${includeRegistrationArtifacts ? ' and registration number' : ''} in preview.`}
            </span>
            <MailCheck className="ml-auto h-4 w-4 text-(--color-accent-success) shrink-0" />
          </div>

          {previewMode === 'rendered' ? (
            <div className="overflow-hidden rounded-(--radius-card) border border-(--color-border-secondary) bg-white">
              <iframe title="email-preview" srcDoc={previewHTML} className="h-190 w-full" />
            </div>
          ) : (
            <div className="space-y-3">
              {/* HTML Section Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-(--radius-card) border border-(--color-border-primary) bg-(--color-background-primary) p-2.5">
                <div className="flex items-center gap-2">
                  {usingCustomHtml ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                      Custom HTML (Editable)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-(--color-border-primary) bg-(--color-background-secondary) px-2.5 py-0.5 text-xs font-medium text-(--color-text-secondary)">
                      Default Template (Type below to edit)
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleLoadStructuredHtml}
                    icon={<RotateCcw className="h-3.5 w-3.5" />}
                  >
                    Load Default Markup
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleStartBlankHtml}
                    icon={<FileCode2 className="h-3.5 w-3.5" />}
                  >
                    Start Blank
                  </Button>
                  {usingCustomHtml && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setRevertModalOpen(true)}
                      icon={<Trash2 className="h-3.5 w-3.5 text-rose-500" />}
                    >
                      Clear Override
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => handleInsertDpButton(rightHtmlEditorRef)}
                    icon={<Sparkles className="h-3.5 w-3.5" />}
                  >
                    + DP Button
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyHtml(currentHtmlValue)}
                    icon={copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </div>

              {/* Dynamic tag chips toolbar */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                <span className="text-[11px] font-semibold text-(--color-text-tertiary) uppercase tracking-wider whitespace-nowrap">
                  Insert Tag:
                </span>
                {PERSONALIZATION_TAGS.map((item) => (
                  <button
                    key={item.tag}
                    type="button"
                    onClick={() => insertTag(item.tag, rightHtmlEditorRef)}
                    title={item.desc}
                    className={`inline-flex shrink-0 items-center gap-1 rounded border px-2 py-0.5 font-mono text-[11px] font-medium transition-colors ${
                      item.highlight
                        ? 'border-(--color-accent-primary) bg-(--color-accent-surface) text-(--color-accent-primary) font-semibold shadow-sm'
                        : 'border-(--color-border-primary) bg-(--color-background-primary) text-(--color-accent-primary) hover:border-(--color-accent-primary) hover:bg-(--color-accent-surface)'
                    }`}
                  >
                    {item.highlight && <Sparkles className="h-3 w-3 text-(--color-accent-primary)" />}
                    {item.tag}
                  </button>
                ))}
              </div>

              {/* Directly Editable HTML Textarea */}
              <div className="relative">
                <textarea
                  ref={rightHtmlEditorRef}
                  value={currentHtmlValue}
                  onChange={(e) => handleHtmlChange(e.target.value)}
                  rows={28}
                  spellCheck={false}
                  placeholder="Paste or write full HTML for complete control..."
                  className="h-170 w-full resize-y rounded-(--radius-card) border border-(--color-border-secondary) bg-(--color-background-primary) p-4 font-mono text-xs leading-relaxed text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:outline-none focus:ring-2 focus:ring-(--color-border-focus)"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-(--color-text-tertiary)">
                <span>Any edits made here directly override the default response email.</span>
                <span>Switch to <strong>Rendered</strong> tab to preview live.</span>
              </div>
            </div>
          )}
        </Card>
      </div>

      <ConfirmationModal
        isOpen={revertModalOpen}
        onClose={() => setRevertModalOpen(false)}
        onConfirm={handleRevertToStructured}
        title="Revert to Standard Template Builder?"
        description="This will clear your custom HTML and restore the default response settings from the standard builder."
        confirmText="Revert to Default"
        cancelText="Keep Custom HTML"
        variant="warning"
      />
    </div>
  );
}

export default withAuth(ResponseEmailEditorPage);
