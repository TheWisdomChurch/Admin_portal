'use client';

// Canonical form builder used by admins to create new public forms.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Copy,
  Eye,
  FileText,
  ImageIcon,
  LayoutTemplate,
  Loader2,
  Plus,
  Save,
  Settings2,
  Wand2,
} from 'lucide-react';

import { Button } from '@/ui/Button';
import { PageHeader } from '@/layouts';
import { Input } from '@/ui/Input';
import { Select } from '@/ui/Select';
import { Textarea } from '@/ui/Textarea';
import { Checkbox } from '@/ui/Checkbox';
import { AlertModal } from '@/ui/AlertModal';
import { SectionCard } from '@/ui/SectionCard';

import { apiClient } from '@/lib/api';
import FormFieldOrderBuilder from '../FormFieldOrderBuilder';
import { FieldEditor, type FieldDraft } from '../_shared/FieldEditor';
import { buildPublicFormUrl } from '@/lib/utils';
import { createFormSchema } from '@/lib/validation/forms';
import { normalizeFieldOptions, sanitizeFieldVisibility } from '@/lib/forms/formFields';
import { DEFAULT_FORM_CONSENT } from '@/lib/forms/formConsent';
import { dateFieldKeepsYear } from '@/lib/forms/formatFieldDate';
import type { CreateFormRequest, EventData, FormSettings } from '@/lib/types';
import { nextUniqueFieldKey, normalizeOrderedFields } from '@/lib/forms/formFieldOrdering';

import { withAuth } from '@/providers/withAuth';
import { useAuthContext } from '@/providers/AuthProviders';
import { extractServerFieldErrors, getFirstServerFieldError, getServerErrorMessage } from '@/lib/serverValidation';

type FormPreset = 'testimonial' | 'member' | 'leadership' | 'children';
type BuilderStep = 'setup' | 'fields' | 'preview';

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

const MAX_BANNER_MB = 5;
const MAX_BANNER_BYTES = MAX_BANNER_MB * 1024 * 1024;
const ACCEPTED_BANNER_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const META_PREFIX = '<!--WH_FORM_TEMPLATE_META:';
const META_SUFFIX = '-->';

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
        label: 'Leadership role or title (e.g. Pastor, Deacon, Cell Leader)',
        type: 'text',
        required: true,
        order: 4,
      },
      { key: 'bio', label: 'Short Bio', type: 'textarea', required: false, order: 5, validation: { maxWords: 400 } },
      // Real date fields (calendar picker), day+month only — no year is stored
      // for leadership; this also guarantees a parseable value instead of the
      // free-text field silently failing to parse and showing "Not provided".
      { key: 'birthday', label: 'Birthday', type: 'date', required: false, order: 6, validation: { dateMode: 'day-month' } },
      { key: 'wedding_anniversary', label: 'Wedding Anniversary', type: 'date', required: false, order: 7, validation: { dateMode: 'day-month' } },
      { key: 'photo', label: 'Profile Photo', type: 'image', required: false, order: 8 },
    ];
  }

  if (preset === 'children') {
    return [
      { key: 'parent_guardian_name', label: 'Parent or guardian name', type: 'text', required: true, order: 1 },
      { key: 'email', label: 'Parent or guardian email', type: 'email', required: true, order: 2 },
      { key: 'primary_phone', label: 'Primary phone number', type: 'tel', required: true, order: 3 },
      { key: 'child_full_name', label: "Child's full name", type: 'text', required: true, order: 4 },
      {
        // Full date (with year) so the ministry can group children by age.
        key: 'child_date_of_birth',
        label: "Child's date of birth",
        type: 'date',
        required: true,
        order: 5,
        validation: { dateMode: 'full' },
      },
      {
        key: 'child_gender',
        label: "Child's gender",
        type: 'radio',
        required: true,
        order: 6,
        options: [
          { label: 'Female', value: 'female' },
          { label: 'Male', value: 'male' },
        ],
      },
      { key: 'home_address', label: 'Home address', type: 'textarea', required: true, order: 7 },
      { key: 'emergency_contact_name', label: 'Emergency contact name', type: 'text', required: true, order: 8 },
      { key: 'emergency_contact_phone', label: 'Emergency contact phone', type: 'tel', required: true, order: 9 },
      { key: 'authorized_pickup', label: 'Authorised pick-up name(s)', type: 'text', required: true, order: 10 },
      { key: 'medical_condition', label: 'Medical condition or allergy', type: 'textarea', required: false, order: 11 },
      {
        key: 'photo_media_release',
        label: 'May we use photos or videos of your child in church media?',
        type: 'radio',
        required: true,
        order: 12,
        options: [
          { label: 'Yes, I permit it', value: 'yes' },
          { label: 'No, keep my child out of media', value: 'no' },
        ],
      },
    ];
  }

  return [
    { key: 'full_name', label: 'Full Name', type: 'text', required: true, order: 1 },
    { key: 'contact_number', label: 'Contact Number', type: 'tel', required: true, order: 2 },
    { key: 'email', label: 'Email Address', type: 'email', required: true, order: 3 },
    { key: 'date_of_birth', label: 'Date of Birth', type: 'date', required: true, order: 4, validation: { dateMode: 'full' } },
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
    <button type="button" onClick={onClick} aria-current={active ? 'step' : undefined} className={`shrink-0 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition ${active ? 'bg-[var(--color-accent-primary)] text-[var(--color-text-onprimary)] shadow-sm' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-background-tertiary)] hover:text-[var(--color-text-primary)]'}`}>
      {children}
    </button>
  );
}

export default withAuth(function NewFormPage() {
	const queryClient = useQueryClient();
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
  const [submitButtonText, setSubmitButtonText] = useState('Submit form');
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
      setIntroBullets('Share valid contact details\nTell us the role or title you serve in\nSubmissions are reviewed before display');
      setIntroBulletSubs('Used for direct follow-up\nShown exactly as you write it\nOnly approved profiles appear publicly');
      setFields(normalizeOrderedFields(buildPresetFields('leadership')));
      return;
    }

    if (preset === 'children') {
      setTitle((current) => current || 'Register Your Child');
      setDescription((current) => current || "Children's ministry registration for parents and guardians.");
      setSlug((current) => current || 'register-child');
      setFormType('general');
      setSubmissionTarget('');
      setSubmissionDepartment('');
      setIntroTitle('Register your child');
      setIntroSubtitle('A few details so our trained team can care for your child from their very first Sunday.');
      setIntroBullets('Tell us about your child and who may collect them\nAdd an emergency contact and any medical needs\nYour details are kept confidential by the children’s ministry team');
      setIntroBulletSubs('Helps us welcome and care for them safely\nSo we can reach you quickly if needed\nUsed only to care for your child');
      setResponseEmailSubject((current) => current || 'Registration received: Register Your Child');
      setResponseEmailHeading((current) => current || 'Registration received');
      setResponseEmailMessage((current) => current || "Thank you. We have your child's details. Our team will welcome you both this Sunday.");
      setSubmitButtonText('Submit registration');
      setFields(normalizeOrderedFields(buildPresetFields('children')));
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
    setFields(normalizeOrderedFields(buildPresetFields('member')));
  }, []);

  useEffect(() => {
    const preset = searchParams.get('preset');
    if (
      preset === 'testimonial' ||
      preset === 'member' ||
      preset === 'leadership' ||
      preset === 'children'
    ) {
      setSelectedPreset(preset);
      applyPreset(preset);
    }
  }, [applyPreset, searchParams]);

  const addField = () => {
    const order = fields.length + 1;
    setFields((prev) => normalizeOrderedFields([
      ...prev,
      { key: nextUniqueFieldKey(prev), label: 'New field', type: 'text', required: false, order },
    ]));
  };

  const updateField = (index: number, updates: Partial<FieldDraft>) => {
    setFields((prev) => prev.map((field, currentIndex) => currentIndex === index ? { ...field, ...updates } : field));
  };

  // Per-field option/visibility editing is owned by the shared <FieldEditor>
  // (forms/_shared/FieldEditor.tsx) — updateField above is its single entry
  // point for all field mutations.

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
        ...field,
        key: (field.key || `field_${index + 1}`).trim(),
        label: field.label.trim(),
        required: field.required,
        options: normalizeFieldOptions(field),
        visibility: sanitizeFieldVisibility(field.visibility),
        order: index + 1,
      })),
      settings: {
        consent: DEFAULT_FORM_CONSENT,
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
        submitButtonText: submitButtonText.trim() || undefined,
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

	  await queryClient.invalidateQueries({ queryKey: ['forms'] });

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

      <section className="overflow-hidden rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 via-[var(--color-background-primary)] to-[var(--color-background-secondary)] p-5 text-[var(--color-text-primary)] shadow-sm sm:p-7">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-100/70 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-amber-800"><LayoutTemplate className="h-4 w-4" />Form publishing studio</div>
            <h1 className="mt-4 max-w-4xl text-2xl font-bold tracking-tight sm:text-3xl">Build, review, and publish your form.</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--color-text-secondary)]">Configure the essentials, add fields, check the public experience, and publish when everything is ready.</p>
          </div>
          <div className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">Public link preview</p>
            <p className="mt-2 break-all font-mono text-sm font-semibold text-[var(--color-text-primary)]">/forms/{normalizeSlug(slug || title || 'your-link')}</p>
            <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">{fields.length} fields configured · {responseEmailEnabled ? 'Response email on' : 'Response email off'}</p>
          </div>
        </div>
      </section>

      <section className="sticky top-2 z-20 rounded-3xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)]/85 p-2 shadow-sm backdrop-blur">
        <div className="flex gap-2 overflow-x-auto">
          <StepButton active={step === 'setup'} onClick={() => setStep('setup')}>Setup</StepButton>
          <StepButton active={step === 'fields'} onClick={() => setStep('fields')}>Fields</StepButton>
          <StepButton active={step === 'preview'} onClick={() => setStep('preview')}>Preview &amp; content</StepButton>
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
                  {/* eslint-disable-next-line no-restricted-syntax -- compound input: "/forms/" prefix sits inline inside the same bordered box, which the shared <Input>'s standalone layout can't express */}
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

              <div className="md:col-span-2"><Textarea label="Description" rows={5} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Write a clean short description. Use '- ' for bullet points." /></div>

              <Select label="Form type" value={formType} onChange={(event) => setFormType(event.target.value as FormSettings['formType'] | '')}>
                  <option value="">Select a type</option>
                  {formTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </Select>

              <Select label="Linked event" value={eventId} onChange={(event) => setEventId(event.target.value)} disabled={eventsLoading}>
                  <option value="">No event (standalone form)</option>
                  {events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}
              </Select>

              <Input label="Capacity (optional)" type="number" min={0} value={capacity} onChange={(event) => setCapacity(event.target.value)} placeholder="e.g., 250" />
              <Input label="Closes At (optional)" type="datetime-local" value={closesAt} onChange={(event) => setClosesAt(event.target.value)} />
              <Input label="Expires At (optional)" type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />

              <Select label="Submission target" value={submissionTarget} onChange={(event) => setSubmissionTarget(event.target.value as FormSettings['submissionTarget'] | '')}>
                  <option value="">Do not route</option>
                  <option value="workforce_new">Workforce (new workers)</option>
                  <option value="workforce_serving">Workforce (already serving)</option>
                  <option value="workforce">Workforce (legacy)</option>
                  <option value="member">Membership (members)</option>
                  <option value="leadership">Leadership applications</option>
                  <option value="testimonial">Testimonials</option>
              </Select>

              <Input label="Department (workforce only)" value={submissionDepartment} onChange={(event) => setSubmissionDepartment(event.target.value)} placeholder="e.g., Hospitality" disabled={!isWorkforceTarget} error={fieldErrors.submissionDepartment} />
            </div>
          </SectionCard>

          <SectionCard title="Quick presets" subtitle="Apply a professional structure for common ministry workflows." icon={<Wand2 className="h-5 w-5" />}>
            <div className="space-y-4">
              <Select label="Preset" value={selectedPreset} onChange={(event) => setSelectedPreset(event.target.value as FormPreset | '')}>
                <option value="">Choose preset</option>
                <option value="testimonial">Testimonial Intake</option>
                <option value="member">New Member Intake</option>
                <option value="leadership">Leadership Intake</option>
                <option value="children">Children Intake</option>
              </Select>
              <Button type="button" variant="outline" icon={<Wand2 className="h-4 w-4" />} disabled={!selectedPreset} onClick={() => selectedPreset && applyPreset(selectedPreset)}>Apply Preset</Button>
              <div className="rounded-3xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">Description preview</p>
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
                <FieldEditor
                  key={`${field.key}-${index}`}
                  field={field}
                  index={index}
                  allFields={orderedFields}
                  onChange={(updates) => updateField(index, updates)}
                  onRemove={() => setRemoveFieldIndex(index)}
                />
              ))}
            </div>
          </div>
        </SectionCard>
      ) : null}

      {step === 'preview' ? (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_420px]">
          <FormPreview
            introTitle={introTitle}
            introSubtitle={introSubtitle}
            formHeaderNote={formHeaderNote}
            introBullets={introBullets}
            fields={orderedFields}
            submitButtonText={submitButtonText}
            coverImageUrl={bannerPreview || coverImageUrl.trim()}
          />

          <div className="space-y-6">
            <SectionCard title="Heading & guidance" subtitle="The title, intro line, and points shown at the top of the public form." icon={<FileText className="h-5 w-5" />}>
              <div className="space-y-4">
                <Input label="Form heading" value={introTitle} onChange={(event) => setIntroTitle(event.target.value)} />
                <Input label="Intro line" value={introSubtitle} onChange={(event) => setIntroSubtitle(event.target.value)} />
                <Textarea label="Guidance points (one per line)" rows={4} value={introBullets} onChange={(event) => setIntroBullets(event.target.value)} />
                <Textarea label="Point subtext (one per line, optional)" rows={4} value={introBulletSubs} onChange={(event) => setIntroBulletSubs(event.target.value)} />
                <Input label="Submit button label" value={submitButtonText} onChange={(event) => setSubmitButtonText(event.target.value)} placeholder="Submit form" />
              </div>
            </SectionCard>

            <SectionCard title="Header image & success message" subtitle="Optional hero image and the confirmation shown after submitting." icon={<ImageIcon className="h-5 w-5" />}>
              <div className="space-y-4">
                <Input label="Header image URL" value={coverImageUrl} onChange={(event) => setCoverImageUrl(event.target.value)} placeholder="https://..." />
                <Input label="Or upload header image" type="file" accept="image/*" onChange={(event) => handleBannerFile(event.target.files?.[0])} />
                {(bannerPreview || coverImageUrl.trim()) ? <div className="flex aspect-[16/7] w-full items-center justify-center overflow-hidden rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-3"><Image src={bannerPreview || coverImageUrl.trim()} alt="Header artwork preview" width={1200} height={525} className="h-full w-full object-contain" unoptimized /></div> : <div className="rounded-2xl border border-dashed border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-8 text-center text-sm font-semibold text-[var(--color-text-tertiary)]">No header image selected.</div>}
                <Input label="Success title" value={successTitle} onChange={(event) => setSuccessTitle(event.target.value)} placeholder="Thank you for registering" />
                <Input label="Success subtitle" value={successSubtitle} onChange={(event) => setSuccessSubtitle(event.target.value)} placeholder="for {{formTitle}}" />
                <Textarea label="Success message" rows={3} value={successMessage} onChange={(event) => setSuccessMessage(event.target.value)} />
              </div>
            </SectionCard>

            <SectionCard title="Response email" subtitle="Automatic confirmation email sent to the person who submitted." icon={<CheckCircle2 className="h-5 w-5" />}>
              <div className="space-y-4">
                <Checkbox label="Send a response email" checked={responseEmailEnabled} onChange={(event) => setResponseEmailEnabled(event.target.checked)} className="min-h-11 rounded-[var(--radius-control)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3" />
                <Input label="Email subject" value={responseEmailSubject} onChange={(event) => setResponseEmailSubject(event.target.value)} disabled={!responseEmailEnabled} />
                <Input label="Template key" value={responseTemplateKeyPreview} disabled />
                <Input label="Email heading" value={responseEmailHeading} onChange={(event) => setResponseEmailHeading(event.target.value)} disabled={!responseEmailEnabled} />
                <Input label="Template image URL" value={responseTemplateUrl} onChange={(event) => setResponseTemplateUrl(event.target.value)} disabled={!responseEmailEnabled} />
                <Input label="Or upload template image" type="file" accept="image/*" onChange={(event) => handleResponseTemplateFile(event.target.files?.[0])} disabled={!responseEmailEnabled} />
                <Textarea label="Email body message" rows={3} value={responseEmailMessage} onChange={(event) => setResponseEmailMessage(event.target.value)} disabled={!responseEmailEnabled} />
                {(responseTemplatePreview || responseTemplateUrl.trim()) ? <Image src={responseTemplatePreview || responseTemplateUrl.trim()} alt="Response template preview" width={1200} height={400} className="max-h-64 w-full rounded-3xl border border-[var(--color-border-secondary)] object-cover" unoptimized /> : null}
              </div>
            </SectionCard>
          </div>
        </section>
      ) : null}

      <section className="rounded-[2rem] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">Form link</p>
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

function FormPreview({
  introTitle,
  introSubtitle,
  formHeaderNote,
  introBullets,
  fields,
  submitButtonText,
  coverImageUrl,
}: {
  introTitle: string;
  introSubtitle: string;
  formHeaderNote: string;
  introBullets: string;
  fields: FieldDraft[];
  submitButtonText: string;
  coverImageUrl?: string;
}) {
  const points = introBullets.split('\n').map((line) => line.trim()).filter(Boolean);
  const questionCount = fields.length;

  return (
    <SectionCard title="Live public preview" subtitle="Approximates the published single-column form members see." icon={<Eye className="h-5 w-5" />}>
      <div className="mx-auto w-full max-w-[34rem] rounded-[1.5rem] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-5 sm:p-6">
        {coverImageUrl ? (
          <Image src={coverImageUrl} alt="Header" width={1200} height={525} unoptimized className="mb-5 aspect-[16/7] w-full rounded-2xl border border-[var(--color-border-secondary)] object-cover" />
        ) : null}

        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--color-accent-primary)]">The Wisdom Church</p>
        <h2 className="mt-2 text-xl font-bold tracking-tight text-[var(--color-text-primary)]">{introTitle || 'Form heading'}</h2>
        {introSubtitle ? <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">{introSubtitle}</p> : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full border border-[var(--color-border-secondary)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-text-tertiary)]">{questionCount} question{questionCount === 1 ? '' : 's'}</span>
          <span className="rounded-full border border-[var(--color-border-secondary)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-text-tertiary)]">about {Math.max(1, Math.round(questionCount * 0.4))} min</span>
        </div>

        {formHeaderNote ? (
          <p className="mt-5 rounded-xl border border-[var(--color-accent-primary)]/25 bg-[var(--color-accent-primary)]/10 p-3 text-xs font-semibold text-[var(--color-text-secondary)]">{formHeaderNote}</p>
        ) : null}

        {points.length > 0 ? (
          <ul className="mt-5 space-y-2">
            {points.map((item) => (
              <li key={item} className="flex gap-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--color-accent-primary)]" />
                {item}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-6 space-y-5">
          {fields.map((field, index) => (
            <FieldPreview key={`${field.key}-${index}`} field={field} />
          ))}
        </div>

        <button type="button" disabled className="mt-7 w-full rounded-[var(--radius-button)] bg-[var(--color-accent-primary)] px-4 py-3 text-sm font-bold text-[var(--color-text-primary)] opacity-90">
          {submitButtonText || 'Submit form'}
        </button>
      </div>
    </SectionCard>
  );
}

/* eslint-disable no-restricted-syntax -- inert `disabled` preview mockups only, never a real interactive control */
function FieldPreview({ field }: { field: FieldDraft }) {
  const boxClass = 'w-full rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-3.5 pb-2 pt-6 text-sm text-[var(--color-text-secondary)]';
  const floatLabel = (
    <span className="pointer-events-none absolute left-3.5 top-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-tertiary)]">
      {field.label}{field.required ? ' *' : ''}
    </span>
  );

  if (field.type === 'textarea') {
    return <div className="relative">{floatLabel}<textarea disabled rows={3} className={boxClass} /></div>;
  }
  if (field.type === 'select') {
    return (
      <div className="relative">
        {floatLabel}
        <select disabled className={boxClass}><option>{(field.options?.[0]?.label) || 'Select…'}</option></select>
      </div>
    );
  }
  if (field.type === 'checkbox') {
    const opts = field.options?.length ? field.options : [{ label: field.label, value: field.key }];
    return (
      <div className="space-y-2">
        <p className="text-sm font-semibold text-[var(--color-text-secondary)]">{field.label}{field.required ? ' *' : ''}</p>
        {opts.map((option) => (
          <label key={option.value} className="flex items-center gap-2.5 rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">
            <span className="h-4 w-4 rounded-[5px] border border-[var(--color-border-primary)]" />{option.label}
          </label>
        ))}
      </div>
    );
  }
  if (field.type === 'radio') {
    return (
      <div className="space-y-2">
        <p className="text-sm font-semibold text-[var(--color-text-secondary)]">{field.label}{field.required ? ' *' : ''}</p>
        {(field.options || []).map((option) => (
          <label key={option.value} className="flex items-center gap-2.5 rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">
            <span className="h-4 w-4 rounded-full border border-[var(--color-border-primary)]" />{option.label}
          </label>
        ))}
      </div>
    );
  }
  if (field.type === 'image') {
    return (
      <div className="space-y-2">
        <p className="text-sm font-semibold text-[var(--color-text-secondary)]">{field.label}{field.required ? ' *' : ''}</p>
        <div className="rounded-[var(--radius-button)] border border-dashed border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-4 py-6 text-center text-xs font-semibold text-[var(--color-text-tertiary)]">Tap to upload or drag an image here · JPEG, PNG, WebP up to 5MB</div>
      </div>
    );
  }
  if (field.type === 'date') {
    const fullDate = dateFieldKeepsYear(field);
    return (
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-[var(--color-text-secondary)]">{field.label}{field.required ? ' *' : ''}</p>
        <div className="flex items-center gap-2.5 rounded-[var(--radius-button)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-3 py-2.5 text-sm text-[var(--color-text-tertiary)]">
          <CalendarDays className="h-4 w-4 shrink-0" />
          <span>{fullDate ? 'Select a date' : 'Select day and month'}</span>
        </div>
        <p className="text-xs text-[var(--color-text-tertiary)]">
          Calendar picker · {fullDate ? 'full date with year (DD-MM-YYYY)' : 'day and month only (DD-MM)'}
        </p>
      </div>
    );
  }

  return <div className="relative">{floatLabel}<input disabled className={boxClass} /></div>;
}
