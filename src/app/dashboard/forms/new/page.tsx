'use client';

// Canonical form builder used by admins to create new public forms.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Eye,
  FileText,
  ImageIcon,
  LayoutTemplate,
  Loader2,
  Palette,
  Plus,
  Save,
  Settings2,
  Trash2,
  Wand2,
} from 'lucide-react';

import { Button } from '@/ui/Button';
import { PageHeader } from '@/layouts';
import { Input } from '@/ui/Input';
import { AlertModal } from '@/ui/AlertModal';
import { SectionCard } from '@/ui/SectionCard';

import { apiClient } from '@/lib/api';
import FormFieldOrderBuilder from '../FormFieldOrderBuilder';
import { buildPublicFormUrl } from '@/lib/utils';
import { createFormSchema } from '@/lib/validation/forms';
import type { CreateFormRequest, EventData, FormFieldType, FormSettings } from '@/lib/types';
import { normalizeOrderedFields } from '@/lib/formFieldOrdering';

import { withAuth } from '@/providers/withAuth';
import { useAuthContext } from '@/providers/AuthProviders';
import { extractServerFieldErrors, getFirstServerFieldError, getServerErrorMessage } from '@/lib/serverValidation';

type FieldDraft = {
  key: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  order: number;
  validation?: { maxWords?: number };
  options?: { label: string; value: string }[];
};

type FormPreset = 'testimonial' | 'member' | 'leadership';
type BuilderStep = 'setup' | 'fields' | 'preview' | 'style';

const dateFormats = ['dd/mm/yyyy', 'yyyy-mm-dd', 'mm/dd/yyyy', 'dd/mm', 'dd-mm'] as const;
type DateFormat = (typeof dateFormats)[number];

const submitButtonIcons = ['check', 'send', 'calendar', 'cursor', 'none'] as const;
type SubmitButtonIcon = (typeof submitButtonIcons)[number];

const formTypeOptions: Array<{ value: NonNullable<FormSettings['formType']>; label: string }> = [
  { value: 'registration', label: 'Registration' },
  { value: 'event', label: 'Event' },
  { value: 'membership', label: 'Membership' },
  { value: 'workforce', label: 'Workforce' },
  { value: 'leadership', label: 'Leadership' },
  { value: 'application', label: 'Application' },
  { value: 'contact', label: 'Contact' },
  { value: 'general', label: 'General' },
];

const monthOptions = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

const dayOptions = Array.from({ length: 31 }, (_, index) => String(index + 1).padStart(2, '0'));

const MAX_BANNER_MB = 5;
const MAX_BANNER_BYTES = MAX_BANNER_MB * 1024 * 1024;
const ACCEPTED_BANNER_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const META_PREFIX = '<!--WH_FORM_TEMPLATE_META:';
const META_SUFFIX = '-->';

const isOptionFieldType = (type: FormFieldType) => type === 'select' || type === 'radio' || type === 'checkbox';

const normalizeSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');

const makeSlugCandidate = (base: string, attempt: number) => {
  if (attempt <= 0) return base;
  const now = new Date();
  const stamp = `${now.getMonth() + 1}${now.getDate()}${now.getHours()}${now.getMinutes()}`;
  return `${base}-${stamp}-${attempt}`;
};

const toOptionValue = (label: string, index: number) =>
  label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || `option-${index + 1}`;

function buildPresetFields(preset: FormPreset): FieldDraft[] {
  if (preset === 'testimonial') {
    return [
      { key: 'full_name', label: 'Full Name', type: 'text', required: true, order: 1 },
      { key: 'email', label: 'Email Address', type: 'email', required: true, order: 2 },
      { key: 'phone', label: 'Contact Number', type: 'tel', required: false, order: 3 },
      { key: 'testimony', label: 'Your Testimony', type: 'textarea', required: true, order: 4, validation: { maxWords: 400 } },
      {
        key: 'allow_sharing',
        label: 'I consent to church sharing this testimony publicly',
        type: 'radio',
        required: true,
        order: 5,
        options: [
          { label: 'Yes, I consent', value: 'yes' },
          { label: 'No, keep private', value: 'no' },
        ],
      },
      { key: 'photo', label: 'Photo Upload (optional)', type: 'image', required: false, order: 6 },
    ];
  }

  if (preset === 'leadership') {
    return [
      { key: 'full_name', label: 'Full Name', type: 'text', required: true, order: 1 },
      { key: 'email', label: 'Email Address', type: 'email', required: true, order: 2 },
      { key: 'phone', label: 'Contact Number', type: 'tel', required: true, order: 3 },
      {
        key: 'leadership_role',
        label: 'Leadership Role',
        type: 'select',
        required: true,
        order: 4,
        options: [
          { label: 'Pastor', value: 'pastor' },
          { label: 'Associate Pastor', value: 'associate_pastor' },
          { label: 'Reverend', value: 'reverend' },
          { label: 'Deacon', value: 'deacon' },
          { label: 'Deaconess', value: 'deaconess' },
        ],
      },
      { key: 'bio', label: 'Short Bio', type: 'textarea', required: false, order: 5, validation: { maxWords: 400 } },
      { key: 'birthday', label: 'Birthday (DD/MM/YYYY)', type: 'text', required: false, order: 6 },
      { key: 'wedding_anniversary', label: 'Wedding Anniversary (DD/MM/YYYY)', type: 'text', required: false, order: 7 },
      { key: 'photo', label: 'Profile Photo', type: 'image', required: false, order: 8 },
    ];
  }

  return [
    { key: 'full_name', label: 'Full Name', type: 'text', required: true, order: 1 },
    { key: 'contact_number', label: 'Contact Number', type: 'tel', required: true, order: 2 },
    { key: 'email', label: 'Email Address', type: 'email', required: true, order: 3 },
    { key: 'date_of_birth', label: 'Date of Birth', type: 'date', required: true, order: 4 },
    { key: 'prayer_request', label: 'Prayer Request (max 400 words)', type: 'textarea', required: false, order: 5, validation: { maxWords: 400 } },
  ];
}

const normalizeAbsoluteHttpUrl = (rawValue: string): { value?: string; error?: string } => {
  const raw = rawValue.trim();
  if (!raw) return {};

  let candidate = raw;
  if (!/^https?:\/\//i.test(candidate)) candidate = `https://${candidate}`;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return { error: 'Template image URL must start with http:// or https://.' };
    if (!parsed.host) return { error: 'Template image URL must include a valid domain.' };
    return { value: parsed.toString() };
  } catch {
    return { error: 'Template image URL is invalid. Use a full URL, e.g. https://...png' };
  }
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const stripTemplateMeta = (html: string) => html.replace(/<!--WH_FORM_TEMPLATE_META:[\s\S]*?-->\s*/g, '');

const embedTemplateMeta = (html: string, meta: { heading?: string; message?: string; imageUrl?: string }) => {
  const payload = encodeURIComponent(JSON.stringify(meta));
  return `${META_PREFIX}${payload}${META_SUFFIX}\n${stripTemplateMeta(html)}`;
};

const buildResponseEmailHTML = (opts: {
  title: string;
  heading: string;
  message: string;
  imageUrl?: string;
  includeRegistrationCode?: boolean;
  includeCalendarOptIn?: boolean;
}) => {
  const safeTitle = escapeHtml(opts.title || 'Registration');
  const safeHeading = escapeHtml(opts.heading || 'Registration Confirmed');
  const safeMessage = escapeHtml(opts.message || 'Thank you for registering.');
  const safeImageUrl = opts.imageUrl ? escapeHtml(opts.imageUrl) : '';
  const includeRegistrationCode = opts.includeRegistrationCode !== false;
  const includeCalendarOptIn = opts.includeCalendarOptIn !== false;

  return `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#ffffff;font-family:Arial,sans-serif;color:#111827;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border:1px solid #fde68a;border-radius:14px;overflow:hidden;">
            <tr><td style="padding:14px 24px 8px 24px;"><div style="height:6px;background:#facc15;border-radius:999px;margin:0 0 12px 0;"></div></td></tr>
            <tr><td style="padding:24px 24px 10px 24px;"><p style="margin:0 0 8px 0;font-size:13px;color:#111827;font-weight:700;">${safeTitle}</p><h2 style="margin:0;font-size:24px;line-height:1.25;color:#111827;">${safeHeading}</h2></td></tr>
            ${safeImageUrl ? `<tr><td style="padding:10px 24px 0 24px;"><img src="${safeImageUrl}" alt="${safeTitle}" style="display:block;width:100%;height:auto;border-radius:10px;" /></td></tr>` : ''}
            <tr><td style="padding:18px 24px 12px 24px;"><p style="margin:0 0 14px 0;font-size:16px;color:#111827;">Hello {{.RecipientName}},</p><p style="margin:0;font-size:15px;line-height:1.7;color:#374151;">${safeMessage}</p>${includeRegistrationCode ? '{{if .RegistrationCode}}' : ''}<div style="margin-top:16px;display:inline-block;padding:10px 14px;border-radius:8px;background:#fff9db;border:1px solid #facc15;font-size:13px;color:#111827;">Registration Number: <strong>{{.RegistrationCode}}</strong></div>${includeRegistrationCode ? '{{end}}' : ''}${includeCalendarOptIn ? '{{if .CalendarOptInURL}}' : ''}<p style="margin:14px 0 0;font-size:13px;color:#111827;"><a href="{{.CalendarOptInURL}}" style="color:#111827;text-decoration:underline;font-weight:700;">Add event to calendar</a></p>${includeCalendarOptIn ? '{{end}}' : ''}</td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim();
};

const renderStructuredLines = (value: string) => {
  const lines = value.split('\n').map((line) => line.trim()).filter(Boolean);
  const bullets = lines.filter((line) => line.startsWith('- ') || line.startsWith('* ')).map((line) => line.replace(/^(-|\*)\s+/, '').trim()).filter(Boolean);
  const paragraphs = lines.filter((line) => !line.startsWith('- ') && !line.startsWith('* '));
  return { bullets, paragraphs };
};

function StepButton({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-2xl px-4 py-2 text-sm font-black transition ${active ? 'bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] shadow-sm' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-background-tertiary)] hover:text-[var(--color-text-primary)]'}`}>
      {children}
    </button>
  );
}

export default withAuth(function NewFormPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const auth = useAuthContext();

  const authBlocked = useMemo(() => !auth.isInitialized || auth.isLoading, [auth.isInitialized, auth.isLoading]);

  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<BuilderStep>('setup');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [slug, setSlug] = useState('');
  const [publishedSlug, setPublishedSlug] = useState<string | null>(null);
  const [events, setEvents] = useState<EventData[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventId, setEventId] = useState('');
  const [formType, setFormType] = useState<FormSettings['formType'] | ''>('registration');
  const [submissionTarget, setSubmissionTarget] = useState<FormSettings['submissionTarget'] | ''>('');
  const [submissionDepartment, setSubmissionDepartment] = useState('');
  const [capacity, setCapacity] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [introTitle, setIntroTitle] = useState('Form Details');
  const [introSubtitle, setIntroSubtitle] = useState('Complete the form below with accurate information.');
  const [introBullets, setIntroBullets] = useState('Provide accurate details\nReview before submitting\nOur team will follow up');
  const [introBulletSubs, setIntroBulletSubs] = useState('Helps us process your response quickly\nPrevents errors in your record\nOnly authorized staff can access submissions');
  const [layoutMode, setLayoutMode] = useState<'split' | 'stack'>('split');
  const [dateFormat, setDateFormat] = useState<DateFormat>('dd-mm');
  const [footerText, setFooterText] = useState('Powered by Wisdom House Registration');
  const [footerBg, setFooterBg] = useState('#f5c400');
  const [footerTextColor, setFooterTextColor] = useState('#111827');
  const [submitButtonText, setSubmitButtonText] = useState('Submit Registration');
  const [submitButtonBg, setSubmitButtonBg] = useState('#f59e0b');
  const [submitButtonTextColor, setSubmitButtonTextColor] = useState('#111827');
  const [submitButtonIcon, setSubmitButtonIcon] = useState<SubmitButtonIcon>('check');
  const [formHeaderNote] = useState('Please ensure details are accurate before submitting.');
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
  const [selectedPreset, setSelectedPreset] = useState<FormPreset | ''>('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [removeFieldIndex, setRemoveFieldIndex] = useState<number | null>(null);
  const [fields, setFields] = useState<FieldDraft[]>([
    { key: 'full_name', label: 'Full Name', type: 'text', required: true, order: 1 },
    { key: 'email', label: 'Email', type: 'email', required: true, order: 2 },
  ]);

  const orderedFields = useMemo(() => normalizeOrderedFields(fields), [fields]);

  const descriptionStructure = useMemo(() => renderStructuredLines(description), [description]);
  const isWorkforceTarget = useMemo(() => submissionTarget === 'workforce' || submissionTarget === 'workforce_new' || submissionTarget === 'workforce_serving', [submissionTarget]);
  const includeRegistrationArtifacts = useMemo(() => {
    const normalizedType = (formType || '').toLowerCase();
    const normalizedTarget = (submissionTarget || '').toLowerCase();
    if (normalizedTarget === 'testimonial' || normalizedTarget === 'member' || normalizedTarget === 'leadership') return false;
    return normalizedType === 'event' || normalizedType === 'registration' || normalizedType === 'workforce';
  }, [formType, submissionTarget]);
  const responseTemplateKeyPreview = useMemo(() => `forms/${normalizeSlug(slug || title || 'your-link')}`, [slug, title]);

  const clearFieldError = (key: string) => setFieldErrors((prev) => {
    if (!prev[key]) return prev;
    const next = { ...prev };
    delete next[key];
    return next;
  });

  const isSlugConflictError = (err: unknown) => {
    const message = getServerErrorMessage(err, '').toLowerCase();
    const statusCode = (err as { statusCode?: number } | null)?.statusCode;
    return statusCode === 409 || (message.includes('slug') && (message.includes('exist') || message.includes('duplicate')));
  };

  const toIso = (value: string) => {
    if (!value) return undefined;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return undefined;
    return d.toISOString();
  };

  const validateBannerFile = (file: File): string | null => {
    if (!ACCEPTED_BANNER_TYPES.includes(file.type)) return 'Banner must be JPEG, PNG, or WebP.';
    if (file.size > MAX_BANNER_BYTES) return `Banner must be ${MAX_BANNER_MB}MB or smaller.`;
    return null;
  };

  useEffect(() => () => {
    if (bannerPreview) URL.revokeObjectURL(bannerPreview);
    if (responseTemplatePreview) URL.revokeObjectURL(responseTemplatePreview);
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
        const res = await apiClient.getEvents({ page: 1, limit: 100 });
        setEvents(Array.isArray(res.data) ? res.data : []);
      } catch {
        setEvents([]);
      } finally {
        setEventsLoading(false);
      }
    })();
  }, []);

  const applyPreset = useCallback((preset: FormPreset) => {
    if (preset === 'testimonial') {
      setTitle((current) => current || 'Share Your Testimony');
      setDescription((current) => current || 'Tell us what God has done in your life.');
      setSlug((current) => current || 'share-testimony');
      setFormType('general');
      setSubmissionTarget('testimonial');
      setSubmissionDepartment('');
      setIntroTitle('Share Your Testimony');
      setIntroSubtitle('Your testimony encourages others and strengthens faith.');
      setIntroBullets('Tell your story clearly\nShare key details\nOur team will review before publishing');
      setIntroBulletSubs('Be specific and truthful\nInclude names only if needed\nOnly approved testimonies go public');
      setDateFormat('dd/mm/yyyy');
      setResponseEmailSubject((current) => current || 'Testimony received: Share Your Testimony');
      setResponseEmailHeading((current) => current || 'Testimony Received');
      setResponseEmailMessage((current) => current || 'Thank you for sharing your testimony. Our team will review it and contact you if we need clarification.');
      setFields(normalizeOrderedFields(buildPresetFields('testimonial')));
      return;
    }

    if (preset === 'leadership') {
      setTitle((current) => current || 'Leadership Application');
      setDescription((current) => current || 'Collect leadership profile details for review and approval.');
      setSlug((current) => current || 'leadership-application');
      setFormType('leadership');
      setSubmissionTarget('leadership');
      setSubmissionDepartment('');
      setIntroTitle('Leadership Application');
      setIntroSubtitle('Provide accurate details for leadership review.');
      setIntroBullets('Share valid contact details\nChoose the role you are applying for\nSubmissions are reviewed before display');
      setIntroBulletSubs('Used for direct follow-up\nHelps routing to the right team\nOnly approved profiles appear publicly');
      setDateFormat('dd-mm');
      setFields(normalizeOrderedFields(buildPresetFields('leadership')));
      return;
    }

    setTitle((current) => current || 'Add New Member');
    setDescription((current) => current || 'Collect new member details for follow-up and care.');
    setSlug((current) => current || 'add-new-member');
    setFormType('membership');
    setSubmissionTarget('member');
    setSubmissionDepartment('');
    setIntroTitle('Add New Member');
    setIntroSubtitle('Complete this membership intake form with accurate details.');
    setIntroBullets('Provide valid contact details\nEnter accurate date of birth\nOptional prayer request up to 400 words');
    setIntroBulletSubs('Used for follow-up and communication\nHelps pastoral care and records\nOnly authorized staff can review');
    setDateFormat('dd-mm');
    setFields(normalizeOrderedFields(buildPresetFields('member')));
  }, []);

  useEffect(() => {
    const preset = searchParams.get('preset');
    if (preset === 'testimonial' || preset === 'member' || preset === 'leadership') {
      setSelectedPreset(preset);
      applyPreset(preset);
    }
  }, [applyPreset, searchParams]);

  const addField = () => {
    const order = fields.length + 1;
    setFields((prev) => normalizeOrderedFields([
      ...prev,
      { key: `field_${order}`, label: 'New field', type: 'text', required: false, order },
    ]));
  };

  const updateField = (index: number, updates: Partial<FieldDraft>) => {
    setFields((prev) => prev.map((field, currentIndex) => currentIndex === index ? { ...field, ...updates } : field));
  };

  const addFieldOption = (fieldIndex: number) => {
    setFields((prev) => prev.map((field, index) => {
      if (index !== fieldIndex) return field;
      const options = Array.isArray(field.options) ? field.options : [];
      const nextIndex = options.length;
      return { ...field, options: [...options, { label: '', value: `option-${nextIndex + 1}` }] };
    }));
  };

  const updateFieldOptionLabel = (fieldIndex: number, optionIndex: number, label: string) => {
    setFields((prev) => prev.map((field, index) => {
      if (index !== fieldIndex) return field;
      const options = Array.isArray(field.options) ? [...field.options] : [];
      if (!options[optionIndex]) return field;
      options[optionIndex] = { label, value: toOptionValue(label, optionIndex) };
      return { ...field, options };
    }));
  };

  const removeFieldOption = (fieldIndex: number, optionIndex: number) => {
    setFields((prev) => prev.map((field, index) => {
      if (index !== fieldIndex) return field;
      const options = Array.isArray(field.options) ? [...field.options] : [];
      options.splice(optionIndex, 1);
      return { ...field, options };
    }));
  };

  const save = async () => {
    setFieldErrors({});
    const normalizedTitle = title.trim();
    const normalizedSlug = normalizeSlug(slug || title);
    let responseTemplateImageUrl = responseTemplateUrl.trim();

    if (!normalizedTitle) {
      setFieldErrors({ title: 'Title is required' });
      toast.error('Title is required');
      setStep('setup');
      return;
    }

    if (!normalizedSlug) {
      setFieldErrors({ slug: 'Form link name is required' });
      toast.error('Form link name is required');
      setStep('setup');
      return;
    }

    if (responseEmailEnabled && responseTemplateFile) {
      try {
        const uploaded = await apiClient.uploadImage(responseTemplateFile, 'email_template');
        responseTemplateImageUrl = uploaded.url;
      } catch (uploadErr) {
        toast.error(getServerErrorMessage(uploadErr, 'Failed to upload response email template image.'));
        return;
      }
    }

    if (responseEmailEnabled && responseTemplateImageUrl) {
      const normalized = normalizeAbsoluteHttpUrl(responseTemplateImageUrl);
      if (normalized.error) {
        toast.error(normalized.error);
        return;
      }
      responseTemplateImageUrl = normalized.value || '';
      setResponseTemplateUrl(responseTemplateImageUrl);
    }

    const payload: CreateFormRequest = {
      title: normalizedTitle,
      description: description.trim() || undefined,
      slug: normalizedSlug,
      eventId: eventId || undefined,
      fields: normalizeOrderedFields(fields).map((field, index) => ({
        key: (field.key || `field_${index + 1}`).trim(),
        label: field.label.trim(),
        type: field.type,
        required: field.required,
        validation: field.validation?.maxWords ? { maxWords: field.validation.maxWords } : undefined,
        options: field.options,
        order: index + 1,
      })),
      settings: {
        formType: formType || undefined,
        capacity: capacity ? Number(capacity) : undefined,
        closesAt: toIso(closesAt),
        expiresAt: toIso(expiresAt),
        submissionTarget: submissionTarget || undefined,
        submissionDepartment: isWorkforceTarget ? submissionDepartment.trim() || undefined : undefined,
        responseEmailEnabled,
        responseEmailSubject: responseEmailSubject.trim() || undefined,
        responseEmailTemplateKey: responseEmailEnabled ? `forms/${normalizedSlug}` : undefined,
        responseEmailTemplateUrl: responseEmailEnabled ? responseTemplateImageUrl || undefined : undefined,
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
        design: coverImageUrl.trim() ? { coverImageUrl: coverImageUrl.trim() } : undefined,
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
      let created;
      let createPayload = { ...payload };
      const baseSlug = normalizedSlug;

      for (let attempt = 0; attempt < 4; attempt += 1) {
        try {
          created = await apiClient.createAdminForm(createPayload);
          break;
        } catch (createErr) {
          if (!isSlugConflictError(createErr) || attempt === 3) throw createErr;
          const nextSlug = makeSlugCandidate(baseSlug, attempt + 1);
          createPayload = { ...createPayload, slug: nextSlug, settings: { ...(createPayload.settings || {}), responseEmailTemplateKey: responseEmailEnabled ? `forms/${nextSlug}` : undefined } };
        }
      }

      if (!created) throw new Error('Unable to create form. Please try again.');

      if (bannerFile) {
        try {
          created = await apiClient.uploadFormBanner(created.id, bannerFile);
        } catch (uploadErr) {
          console.error('Banner upload failed:', uploadErr);
          toast.error('Form saved, but banner upload failed.');
        }
      }

      if (responseEmailEnabled) {
        const templateKey = `forms/${created.slug || normalizedSlug || created.id}`;
        const isTestimonialTarget = submissionTarget === 'testimonial';
        const templateSubject = responseEmailSubject.trim() || `${isTestimonialTarget ? 'Testimony received' : includeRegistrationArtifacts ? 'Registration received' : 'Submission received'}: ${created.title || normalizedTitle}`;
        const htmlBody = embedTemplateMeta(
          buildResponseEmailHTML({
            title: created.title || normalizedTitle,
            heading: responseEmailHeading.trim(),
            message: responseEmailMessage.trim(),
            imageUrl: responseTemplateImageUrl || undefined,
            includeRegistrationCode: includeRegistrationArtifacts,
            includeCalendarOptIn: includeRegistrationArtifacts,
          }),
          {
            heading: responseEmailHeading.trim() || undefined,
            message: responseEmailMessage.trim() || undefined,
            imageUrl: responseTemplateImageUrl || undefined,
          },
        );

        try {
          const template = await apiClient.createAdminEmailTemplate({ templateKey, ownerType: 'form', ownerId: created.id, subject: templateSubject, htmlBody, status: 'active', activate: true });
          created = await apiClient.updateAdminForm(created.id, {
            settings: {
              ...(created.settings || {}),
              responseEmailEnabled: true,
              responseEmailSubject: templateSubject,
              responseEmailTemplateKey: templateKey,
              responseEmailTemplateId: template.id,
              responseEmailTemplateUrl: responseTemplateImageUrl || undefined,
            },
          });
        } catch (templateErr) {
          toast.error(getServerErrorMessage(templateErr, 'Form saved, but response email template could not be saved.'));
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

      setPublishedSlug(publishedOk ? slugToUse : null);
      if (publishedOk) toast.success('Form created and link ready');
      else {
        toast.success('Form created');
        toast.error(publishError || 'Publish the form to get a live link.');
      }

      router.push(`/dashboard/forms/${created.id}/edit`);
    } catch (err) {
      console.error(err);
      const serverFieldErrors = extractServerFieldErrors(err);
      if (Object.keys(serverFieldErrors).length > 0) {
        setFieldErrors(serverFieldErrors);
        toast.error(getFirstServerFieldError(serverFieldErrors) || 'Please review the highlighted fields.');
        return;
      }
      toast.error(getServerErrorMessage(err, 'Failed to create form'));
    } finally {
      setSaving(false);
    }
  };

  const pendingField = removeFieldIndex !== null ? fields[removeFieldIndex] : null;

  if (authBlocked) return <div className="flex min-h-[300px] w-full items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-[var(--color-text-primary)]" /></div>;

  return (
    <main className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Button variant="ghost" onClick={() => router.back()}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
          <PageHeader title="Create Form" subtitle="Build a professional public form with routing, response email, media, and a live preview." />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setStep('preview')} icon={<Eye className="h-4 w-4" />}>Preview</Button>
          <Button onClick={() => void save()} loading={saving} disabled={saving} icon={<Save className="h-4 w-4" />}>Create & Publish</Button>
        </div>
      </div>

      <section className="overflow-hidden rounded-[2rem] border border-[var(--color-border-secondary)] bg-[var(--color-text-primary)] p-6 text-[var(--color-text-inverse)] shadow-xl">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-text-inverse)]/10 bg-[var(--color-text-inverse)]/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-[var(--color-text-inverse)]/65"><LayoutTemplate className="h-4 w-4" />Form publishing studio</div>
            <h1 className="mt-4 max-w-4xl text-3xl font-black tracking-tight sm:text-4xl">Design the form, route the submission, preview the public experience, then publish.</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--color-text-inverse)]/65">The builder keeps advanced form settings intact while making the workflow clearer.</p>
          </div>
          <div className="rounded-3xl border border-[var(--color-text-inverse)]/10 bg-[var(--color-text-inverse)]/10 p-4 backdrop-blur">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--color-text-inverse)]/50">Public link preview</p>
            <p className="mt-2 break-all text-sm font-bold text-[var(--color-text-inverse)]/75">/forms/{normalizeSlug(slug || title || 'your-link')}</p>
            <p className="mt-2 text-xs font-semibold text-[var(--color-text-inverse)]/45">{fields.length} fields configured · {responseEmailEnabled ? 'Response email on' : 'Response email off'}</p>
          </div>
        </div>
      </section>

      <section className="sticky top-2 z-20 rounded-3xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)]/85 p-2 shadow-sm backdrop-blur">
        <div className="flex gap-2 overflow-x-auto">
          <StepButton active={step === 'setup'} onClick={() => setStep('setup')}>Setup</StepButton>
          <StepButton active={step === 'fields'} onClick={() => setStep('fields')}>Fields</StepButton>
          <StepButton active={step === 'preview'} onClick={() => setStep('preview')}>Preview</StepButton>
          <StepButton active={step === 'style'} onClick={() => setStep('style')}>Style</StepButton>
        </div>
      </section>

      {step === 'setup' ? (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <SectionCard title="Core form setup" subtitle="Name the form, define the public link, choose routing, and attach event settings." icon={<FileText className="h-5 w-5" />}>
            <div className="grid gap-5 md:grid-cols-2">
              <Input label="Title *" value={title} onChange={(event) => { clearFieldError('title'); setTitle(event.target.value); }} placeholder="e.g., Youth Summit Registration" error={fieldErrors.title} />
              <div className="space-y-2">
                <label className="block text-sm font-medium text-[var(--color-text-secondary)]">Public Link Slug *</label>
                <div className={`flex items-center rounded-[var(--radius-button)] border bg-[var(--color-background-secondary)] pl-3 text-sm transition focus-within:ring-2 focus-within:ring-[var(--color-border-focus)] ${fieldErrors.slug ? 'border-[var(--color-border-error)] focus-within:ring-[var(--color-border-error)]' : 'border-[var(--color-border-primary)]'}`}>
                  <span className="shrink-0 select-none font-mono text-[var(--color-text-tertiary)]">/forms/</span>
                  <input
                    value={slug}
                    onChange={(event) => { clearFieldError('slug'); setSlug(event.target.value); }}
                    onBlur={() => setSlug((current) => normalizeSlug(current))}
                    placeholder="wpc"
                    className="h-10 w-full min-w-0 rounded-r-[var(--radius-button)] bg-transparent py-2 pr-3 font-mono text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-tertiary)]"
                  />
                </div>
                {fieldErrors.slug ? (
                  <p className="text-sm text-[var(--color-danger-text)]">{fieldErrors.slug}</p>
                ) : (
                  <p className="text-xs font-semibold text-[var(--color-text-tertiary)]">This becomes the public link visitors use to open the form.</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-bold text-[var(--color-text-secondary)]">Description</label>
                <textarea className="w-full rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 py-2 text-sm font-semibold leading-7 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-border-focus)]" rows={5} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Write a clean short description. Use '- ' for bullet points." />
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold text-[var(--color-text-secondary)]">Form Type</label>
                <select className="w-full rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 py-2.5 text-sm font-semibold text-[var(--color-text-secondary)] outline-none" value={formType} onChange={(event) => setFormType(event.target.value as FormSettings['formType'] | '')}>
                  <option value="">Select a type</option>
                  {formTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold text-[var(--color-text-secondary)]">Linked Event</label>
                <select className="w-full rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 py-2.5 text-sm font-semibold text-[var(--color-text-secondary)] outline-none" value={eventId} onChange={(event) => setEventId(event.target.value)} disabled={eventsLoading}>
                  <option value="">No event (standalone form)</option>
                  {events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}
                </select>
              </div>

              <Input label="Capacity (optional)" type="number" min={0} value={capacity} onChange={(event) => setCapacity(event.target.value)} placeholder="e.g., 250" />
              <Input label="Closes At (optional)" type="datetime-local" value={closesAt} onChange={(event) => setClosesAt(event.target.value)} />
              <Input label="Expires At (optional)" type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />

              <div>
                <label className="mb-1 block text-sm font-bold text-[var(--color-text-secondary)]">Submission Target</label>
                <select className="w-full rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 py-2.5 text-sm font-semibold text-[var(--color-text-secondary)] outline-none" value={submissionTarget} onChange={(event) => setSubmissionTarget(event.target.value as FormSettings['submissionTarget'] | '')}>
                  <option value="">Do not route</option>
                  <option value="workforce_new">Workforce (new workers)</option>
                  <option value="workforce_serving">Workforce (already serving)</option>
                  <option value="workforce">Workforce (legacy)</option>
                  <option value="member">Membership (members)</option>
                  <option value="leadership">Leadership applications</option>
                  <option value="testimonial">Testimonials</option>
                </select>
              </div>

              <Input label="Department (workforce only)" value={submissionDepartment} onChange={(event) => setSubmissionDepartment(event.target.value)} placeholder="e.g., Hospitality" disabled={!isWorkforceTarget} error={fieldErrors.submissionDepartment} />
            </div>
          </SectionCard>

          <SectionCard title="Quick presets" subtitle="Apply a professional structure for common ministry workflows." icon={<Wand2 className="h-5 w-5" />}>
            <div className="space-y-4">
              <select value={selectedPreset} onChange={(event) => setSelectedPreset(event.target.value as FormPreset | '')} className="w-full rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 py-2.5 text-sm font-black text-[var(--color-text-secondary)] outline-none">
                <option value="">Choose preset</option>
                <option value="testimonial">Testimonial Intake</option>
                <option value="member">New Member Intake</option>
                <option value="leadership">Leadership Intake</option>
              </select>
              <Button type="button" variant="outline" icon={<Wand2 className="h-4 w-4" />} disabled={!selectedPreset} onClick={() => selectedPreset && applyPreset(selectedPreset)}>Apply Preset</Button>
              <div className="rounded-3xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">Description preview</p>
                <div className="mt-3 space-y-2 text-sm font-semibold leading-6 text-[var(--color-text-secondary)]">
                  {descriptionStructure.paragraphs.length === 0 && descriptionStructure.bullets.length === 0 ? <p>No description yet.</p> : null}
                  {descriptionStructure.paragraphs.map((paragraph, index) => <p key={`description-paragraph-${index}`}>{paragraph}</p>)}
                  {descriptionStructure.bullets.length > 0 ? <ul className="list-disc space-y-1 pl-5">{descriptionStructure.bullets.map((item, index) => <li key={`description-bullet-${index}`}>{item}</li>)}</ul> : null}
                </div>
              </div>
            </div>
          </SectionCard>
        </section>
      ) : null}

      {step === 'fields' ? (
        <SectionCard
          title="Form builder"
          subtitle="Add fields, arrange the order, configure options, and mark required answers."
          icon={<Settings2 className="h-5 w-5" />}
          actions={<Button variant="outline" onClick={() => addField()} icon={<Plus className="h-4 w-4" />}>Add Field</Button>}
        >
          <div className="space-y-5">
            <FormFieldOrderBuilder<FieldDraft>
              fields={fields}
              onChange={(nextFields) => setFields(normalizeOrderedFields(nextFields))}
              title="Arrange public form fields"
              description="Drag fields into the exact order members should see on the public form. The saved form order will follow this arrangement."
            />

            <div className="space-y-4">
              {orderedFields.map((field, index) => (
                <div key={`${field.key}-${index}`} className="rounded-[1.5rem] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">Field #{index + 1}</p>
                      <p className="mt-1 text-sm font-semibold text-[var(--color-text-tertiary)]">{field.key || `field_${index + 1}`} • {field.type}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setRemoveFieldIndex(index)} icon={<Trash2 className="h-4 w-4" />}>Remove</Button>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_140px] lg:items-end">
                    <Input label="Label" value={field.label} onChange={(event) => updateField(index, { label: event.target.value })} />
                    <div>
                      <label className="mb-1 block text-sm font-bold text-[var(--color-text-secondary)]">Type</label>
                      <select value={field.type} onChange={(event) => {
                        const nextType = event.target.value as FormFieldType;
                        const nextOptions = isOptionFieldType(nextType) && (!Array.isArray(field.options) || field.options.length === 0)
                          ? [{ label: 'Option 1', value: 'option-1' }, { label: 'Option 2', value: 'option-2' }]
                          : isOptionFieldType(nextType) ? field.options : undefined;
                        updateField(index, { type: nextType, options: nextOptions });
                      }} className="w-full rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 py-2.5 text-sm font-semibold text-[var(--color-text-secondary)] outline-none">
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
                    </div>
                    <label className="flex items-center gap-2 rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 py-2.5 text-sm font-black text-[var(--color-text-secondary)]"><input type="checkbox" checked={field.required} onChange={(event) => updateField(index, { required: event.target.checked })} />Required</label>
                  </div>

                  {field.type === 'textarea' ? (
                    <div className="mt-3 max-w-xs"><Input label="Max words (optional)" type="number" min={1} value={field.validation?.maxWords ?? ''} onChange={(event) => updateField(index, { validation: { ...(field.validation || {}), maxWords: event.target.value ? Number(event.target.value) : undefined } })} placeholder="e.g., 400" /></div>
                  ) : null}

                  {isOptionFieldType(field.type) ? (
                    <div className="mt-4 space-y-3 rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-4">
                      <div className="flex items-center justify-between gap-3"><p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">Options</p><Button type="button" variant="outline" size="sm" onClick={() => addFieldOption(index)} icon={<Plus className="h-4 w-4" />}>Add option</Button></div>
                      {(field.options || []).map((option, optionIndex) => (
                        <div key={`${option.value}-${optionIndex}`} className="flex items-center gap-2">
                          <Input value={option.label} onChange={(event) => updateFieldOptionLabel(index, optionIndex, event.target.value)} placeholder={`Option ${optionIndex + 1}`} />
                          <Button type="button" variant="outline" size="sm" onClick={() => removeFieldOption(index, optionIndex)} icon={<Trash2 className="h-4 w-4" />}>Remove</Button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      ) : null}

      {step === 'preview' ? (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_420px]">
          <FormPreview
            layoutMode={layoutMode}
            introTitle={introTitle}
            introSubtitle={introSubtitle}
            formHeaderNote={formHeaderNote}
            introBullets={introBullets}
            introBulletSubs={introBulletSubs}
            fields={orderedFields}
            dateFormat={dateFormat}
            submitButtonText={submitButtonText}
            submitButtonBg={submitButtonBg}
            submitButtonTextColor={submitButtonTextColor}
            submitButtonIcon={submitButtonIcon}
            footerText={footerText}
            footerBg={footerBg}
            footerTextColor={footerTextColor}
          />

          <SectionCard title="Media and success state" subtitle="Configure public header image, success modal copy, and response email image." icon={<ImageIcon className="h-5 w-5" />}>
            <div className="space-y-4">
              <Input label="Header image URL" value={coverImageUrl} onChange={(event) => setCoverImageUrl(event.target.value)} placeholder="https://..." />
              <Input label="Or upload header image" type="file" accept="image/*" onChange={(event) => handleBannerFile(event.target.files?.[0])} />
              {(bannerPreview || coverImageUrl.trim()) ? <Image src={bannerPreview || coverImageUrl.trim()} alt="Banner preview" width={1200} height={400} className="max-h-64 w-full rounded-3xl border border-[var(--color-border-secondary)] object-cover" unoptimized /> : <div className="rounded-3xl border border-dashed border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-8 text-center text-sm font-bold text-[var(--color-text-tertiary)]">No header image selected.</div>}
              <Input label="Success modal title" value={successTitle} onChange={(event) => setSuccessTitle(event.target.value)} placeholder="Thank you for registering" />
              <Input label="Success modal subtitle" value={successSubtitle} onChange={(event) => setSuccessSubtitle(event.target.value)} placeholder="for {{formTitle}}" />
              <label className="grid gap-1.5"><span className="text-sm font-bold text-[var(--color-text-secondary)]">Success modal message</span><textarea className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 py-2 text-sm font-semibold leading-7 text-[var(--color-text-primary)] outline-none" rows={3} value={successMessage} onChange={(event) => setSuccessMessage(event.target.value)} /></label>
            </div>
          </SectionCard>
        </section>
      ) : null}

      {step === 'style' ? (
        <section className="grid gap-6 xl:grid-cols-2">
          <SectionCard title="Public layout and copy" subtitle="Fine-tune the left-side information panel and field presentation." icon={<Palette className="h-5 w-5" />}>
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Left column title" value={introTitle} onChange={(event) => setIntroTitle(event.target.value)} />
              <Input label="Left column subtitle" value={introSubtitle} onChange={(event) => setIntroSubtitle(event.target.value)} />
              <label className="grid gap-1.5"><span className="text-sm font-bold text-[var(--color-text-secondary)]">Left column bullets</span><textarea className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 py-2 text-sm font-semibold leading-7 text-[var(--color-text-primary)] outline-none" rows={4} value={introBullets} onChange={(event) => setIntroBullets(event.target.value)} /></label>
              <label className="grid gap-1.5"><span className="text-sm font-bold text-[var(--color-text-secondary)]">Bullet subtext</span><textarea className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 py-2 text-sm font-semibold leading-7 text-[var(--color-text-primary)] outline-none" rows={4} value={introBulletSubs} onChange={(event) => setIntroBulletSubs(event.target.value)} /></label>
              <div><label className="mb-1 block text-sm font-bold text-[var(--color-text-secondary)]">Layout</label><select value={layoutMode} onChange={(event) => setLayoutMode(event.target.value as 'split' | 'stack')} className="w-full rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 py-2.5 text-sm font-semibold text-[var(--color-text-secondary)] outline-none"><option value="split">Two column layout</option><option value="stack">Single column layout</option></select></div>
              <div><label className="mb-1 block text-sm font-bold text-[var(--color-text-secondary)]">Date format</label><select value={dateFormat} onChange={(event) => setDateFormat(event.target.value as DateFormat)} className="w-full rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 py-2.5 text-sm font-semibold text-[var(--color-text-secondary)] outline-none">{dateFormats.map((format) => <option key={format} value={format}>{format.toUpperCase()}</option>)}</select></div>
            </div>
          </SectionCard>

          <SectionCard title="Footer, submit button, and response email" subtitle="Control button styling and configure automatic confirmation." icon={<CheckCircle2 className="h-5 w-5" />}>
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Footer text" value={footerText} onChange={(event) => setFooterText(event.target.value)} />
              <Input label="Submit button text" value={submitButtonText} onChange={(event) => setSubmitButtonText(event.target.value)} />
              <ColorInput label="Footer background" value={footerBg} onChange={setFooterBg} />
              <ColorInput label="Footer text" value={footerTextColor} onChange={setFooterTextColor} />
              <ColorInput label="Button background" value={submitButtonBg} onChange={setSubmitButtonBg} />
              <ColorInput label="Button text" value={submitButtonTextColor} onChange={setSubmitButtonTextColor} />
              <div><label className="mb-1 block text-sm font-bold text-[var(--color-text-secondary)]">Submit icon</label><select value={submitButtonIcon} onChange={(event) => setSubmitButtonIcon(event.target.value as SubmitButtonIcon)} className="w-full rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 py-2.5 text-sm font-semibold text-[var(--color-text-secondary)] outline-none">{submitButtonIcons.map((icon) => <option key={icon} value={icon}>{icon}</option>)}</select></div>
              <label className="flex items-center gap-2 rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 py-2 text-sm font-black text-[var(--color-text-secondary)]"><input type="checkbox" checked={responseEmailEnabled} onChange={(event) => setResponseEmailEnabled(event.target.checked)} />Enable response email</label>
              <Input label="Email subject" value={responseEmailSubject} onChange={(event) => setResponseEmailSubject(event.target.value)} disabled={!responseEmailEnabled} />
              <Input label="Template key" value={responseTemplateKeyPreview} disabled />
              <Input label="Email heading" value={responseEmailHeading} onChange={(event) => setResponseEmailHeading(event.target.value)} disabled={!responseEmailEnabled} />
              <Input label="Template image URL" value={responseTemplateUrl} onChange={(event) => setResponseTemplateUrl(event.target.value)} disabled={!responseEmailEnabled} />
              <Input label="Or upload template image" type="file" accept="image/*" onChange={(event) => handleResponseTemplateFile(event.target.files?.[0])} disabled={!responseEmailEnabled} />
              <label className="grid gap-1.5 md:col-span-2"><span className="text-sm font-bold text-[var(--color-text-secondary)]">Email body message</span><textarea className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 py-2 text-sm font-semibold leading-7 text-[var(--color-text-primary)] outline-none disabled:opacity-50" rows={3} value={responseEmailMessage} onChange={(event) => setResponseEmailMessage(event.target.value)} disabled={!responseEmailEnabled} /></label>
              {(responseTemplatePreview || responseTemplateUrl.trim()) ? <Image src={responseTemplatePreview || responseTemplateUrl.trim()} alt="Response template preview" width={1200} height={400} className="max-h-64 w-full rounded-3xl border border-[var(--color-border-secondary)] object-cover md:col-span-2" unoptimized /> : null}
            </div>
          </SectionCard>
        </section>
      ) : null}

      <section className="rounded-[2rem] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">Form link</p>
            <p className="mt-2 break-all text-sm font-bold text-[var(--color-text-secondary)]">{publishedSlug ? buildPublicFormUrl(publishedSlug) : 'Create & publish to generate link'}</p>
          </div>
          <Button variant="outline" size="sm" onClick={async () => {
            if (!publishedSlug) {
              toast.error('Publish first to copy link');
              return;
            }
            const url = buildPublicFormUrl(publishedSlug);
            if (!url) {
              toast.error('Unable to build public link');
              return;
            }
            await navigator.clipboard.writeText(url);
            toast.success('Link copied');
          }} icon={<Copy className="h-4 w-4" />} disabled={!publishedSlug}>Copy</Button>
        </div>
      </section>

      <AlertModal
        open={removeFieldIndex !== null}
        onClose={() => setRemoveFieldIndex(null)}
        title="Remove Field"
        description={`Remove "${pendingField?.label || 'this field'}"? This will delete it from the form.`}
        primaryAction={{
          label: 'Remove',
          onClick: () => {
            if (removeFieldIndex === null) return;
            setFields((prev) => normalizeOrderedFields(prev.filter((_, index) => index !== removeFieldIndex)));
            setRemoveFieldIndex(null);
          },
          variant: 'danger',
        }}
        secondaryAction={{ label: 'Cancel', onClick: () => setRemoveFieldIndex(null), variant: 'outline' }}
      />
    </main>
  );
}, { requiredRole: 'admin' });

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-bold text-[var(--color-text-secondary)]">{label}</span>
      <div className="flex items-center gap-3 rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 py-2">
        <input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-8 w-12 rounded border border-[var(--color-border-secondary)] bg-transparent" />
        <span className="text-xs font-black text-[var(--color-text-tertiary)]">{value}</span>
      </div>
    </label>
  );
}

function FormPreview({
  layoutMode,
  introTitle,
  introSubtitle,
  formHeaderNote,
  introBullets,
  introBulletSubs,
  fields,
  dateFormat,
  submitButtonText,
  submitButtonBg,
  submitButtonTextColor,
  submitButtonIcon,
  footerText,
  footerBg,
  footerTextColor,
}: {
  layoutMode: 'split' | 'stack';
  introTitle: string;
  introSubtitle: string;
  formHeaderNote: string;
  introBullets: string;
  introBulletSubs: string;
  fields: FieldDraft[];
  dateFormat: DateFormat;
  submitButtonText: string;
  submitButtonBg: string;
  submitButtonTextColor: string;
  submitButtonIcon: SubmitButtonIcon;
  footerText: string;
  footerBg: string;
  footerTextColor: string;
}) {
  const bulletSubtexts = introBulletSubs.split('\n');

  return (
    <SectionCard title="Live public preview" subtitle="This approximates what visitors will see on the published form." icon={<Eye className="h-5 w-5" />}>
      <div className={`grid gap-6 ${layoutMode === 'split' ? 'lg:grid-cols-[1.1fr_1fr]' : 'grid-cols-1'}`}>
        <div className="space-y-4 rounded-[1.5rem] border border-[var(--color-border-secondary)] bg-[var(--color-text-primary)] p-5 text-[var(--color-text-inverse)]">
          <div className="inline-flex items-center rounded-full border border-[var(--color-text-inverse)]/10 bg-[var(--color-text-inverse)]/10 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-[var(--color-text-inverse)]/60">Preview</div>
          <h2 className="text-3xl font-black tracking-tight">{introTitle || 'Form Details'}</h2>
          <p className="text-sm leading-7 text-[var(--color-text-inverse)]/65">{introSubtitle || 'Secure your spot by registering below.'}</p>
          {formHeaderNote ? <p className="rounded-2xl border border-[var(--color-text-inverse)]/10 bg-[var(--color-text-inverse)]/10 p-3 text-xs font-semibold text-[var(--color-text-inverse)]/55">{formHeaderNote}</p> : null}
          <div className="grid gap-3">
            {introBullets.split('\n').filter(Boolean).map((item, index) => (
              <div key={item} className="flex items-center gap-3 rounded-2xl border border-[var(--color-text-inverse)]/10 bg-[var(--color-text-inverse)]/10 px-4 py-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-accent-primary)] text-sm font-black text-[var(--color-text-primary)]">{index + 1}</div>
                <div className="text-sm leading-relaxed text-[var(--color-text-inverse)]/70">
                  <div className="font-black text-[var(--color-text-inverse)]">{item}</div>
                  {bulletSubtexts[index] ? <div className="mt-1 text-xs text-[var(--color-text-inverse)]/45">{bulletSubtexts[index]}</div> : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4 rounded-[1.5rem] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-5">
          {fields.map((field, index) => (
            <div key={`${field.key}-${index}`} className="space-y-1">
              {field.type !== 'checkbox' ? <label className="block text-sm font-black text-[var(--color-text-secondary)]">{field.label} {field.required ? <span className="text-[var(--color-danger-text)]">*</span> : null}</label> : null}
              {renderFieldPreview(field, dateFormat)}
            </div>
          ))}
          <button type="button" disabled className="w-full rounded-2xl px-4 py-2.5 text-sm font-black shadow-sm" style={{ background: submitButtonBg, color: submitButtonTextColor, opacity: 0.9 }}>
            <span className="inline-flex items-center justify-center gap-2">{submitButtonIcon !== 'none' ? <span>{submitButtonIcon === 'check' ? '✔' : submitButtonIcon === 'send' ? '➜' : submitButtonIcon === 'calendar' ? '📅' : '✦'}</span> : null}{submitButtonText || 'Submit Registration'}</span>
          </button>
          <div className="rounded-2xl px-3 py-2 text-center text-xs font-black" style={{ background: footerBg, color: footerTextColor }}>{footerText}</div>
        </div>
      </div>
    </SectionCard>
  );
}

function renderFieldPreview(field: FieldDraft, dateFormat: DateFormat) {
  const inputClass = 'w-full rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 py-2 text-sm font-semibold text-[var(--color-text-secondary)]';

  if (field.type === 'textarea') return <textarea disabled className={inputClass} rows={3} placeholder={field.label} />;
  if (field.type === 'select') return <select disabled className={inputClass}><option value="">Select...</option>{(field.options || []).map((option) => <option key={option.value}>{option.label}</option>)}</select>;
  if (field.type === 'checkbox') return (field.options?.length ? field.options : [{ label: field.label, value: field.key }]).map((option) => <label key={option.value} className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)]"><input type="checkbox" disabled className="h-4 w-4 rounded border-[var(--color-border-primary)]" />{option.label}</label>);
  if (field.type === 'radio') return <div className="space-y-1">{(field.options || []).map((option) => <label key={option.value} className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)]"><input type="radio" disabled className="h-4 w-4 rounded-full border-[var(--color-border-primary)]" />{option.label}</label>)}</div>;
  if (field.type === 'image') return <div className="space-y-1"><input disabled type="file" accept="image/jpeg,image/png,image/webp" className={inputClass} /><p className="text-[11px] font-semibold text-[var(--color-text-tertiary)]">JPEG, PNG, WebP up to 5MB</p></div>;
  if (field.type === 'date') return <div><div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><select disabled className={inputClass}><option value="">Select day</option>{dayOptions.map((day) => <option key={day} value={day}>{day}</option>)}</select><select disabled className={inputClass}><option value="">Select month</option>{monthOptions.map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}</select></div><p className="mt-1 text-[11px] font-semibold text-[var(--color-text-tertiary)]">Format: {dateFormat.toUpperCase()}</p></div>;

  return <input disabled type={field.type} className={inputClass} placeholder={field.label} />;
}
