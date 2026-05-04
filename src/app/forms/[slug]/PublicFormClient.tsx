// src/app/forms/[slug]/PublicFormClient.tsx
'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { Calendar, Check, MousePointer2, Send } from 'lucide-react';
import { apiClient } from '@/lib/api';
import type { PublicFormPayload, FormField, UploadedFormAssetValue, SubmittedFormValue } from '@/lib/types';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { SuccessModal } from '@/ui/SuccessModal';
import { extractServerFieldErrors, getFirstServerFieldError, getServerErrorMessage } from '@/lib/serverValidation';
import { prepareUploadPayload} from '@/lib/prepareUploadPayload';


/* ========================================================================
   Leadership public form hardening:
   - Uploads file and data:base64 values before submit.
   - Stores bucket public URLs in values instead of raw base64.
   - Normalizes birthday from DD-MM/DD/MM to DD/MM.
   - Prevents bad field-key mappings like birthday="single" from breaking sync.
======================================================================== */

type PublicSubmissionValue =
  | string
  | boolean
  | number
  | string[]
  | UploadedFormAssetValue
  | File
  | null;

type PublicSubmissionValues = Record<string, PublicSubmissionValue>;

/**
 * Final backend submission values.
 * This must match SubmitFormRequest.values and must never contain File.
 */
type SubmittedPublicSubmissionValues = Record<string, SubmittedFormValue>;



function normalizeDayMonth(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const match = trimmed.match(/^(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.]\d{2,4})?$/);
  if (!match) return undefined;

  const first = Number(match[1]);
  const second = Number(match[2]);

  if (!Number.isInteger(first) || !Number.isInteger(second)) return undefined;

  let day = first;
  let month = second;

  // If user supplied MM/DD, convert it to DD/MM.
  if (first <= 12 && second > 12) {
    day = second;
    month = first;
  }

  if (month < 1 || month > 12) return undefined;
  if (day < 1 || day > 31) return undefined;

  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
}

function normalizeLeadershipRole(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');

  const allowed = new Set([
    'senior_pastor',
    'associate_pastor',
    'deacon',
    'deaconess',
    'reverend',
  ]);

  return allowed.has(normalized) ? normalized : undefined;
}

function findLeadershipBirthday(values: PublicSubmissionValues): string | undefined {
  const preferredKeys = [
    'birthday',
    'birthDay',
    'dateOfBirth',
    'date_of_birth',
    'dob',
    'bio',
  ];

  for (const key of preferredKeys) {
    const normalized = normalizeDayMonth(values[key]);
    if (normalized) return normalized;
  }

  for (const value of Object.values(values)) {
    const normalized = normalizeDayMonth(value);
    if (normalized) return normalized;
  }

  return undefined;
}

function shouldNormalizeLeadershipValues(slug: string): boolean {
  const normalized = slug.trim().toLowerCase();
  return (
    normalized === 'leadership-biodata' ||
    normalized === 'leadership' ||
    normalized.includes('leadership')
  );
}

async function prepareLeadershipPublicSubmissionValues(
  slug: string,
  values: SubmittedPublicSubmissionValues
): Promise<SubmittedPublicSubmissionValues> {
  if (!shouldNormalizeLeadershipValues(slug)) {
    return values;
  }

  const next: SubmittedPublicSubmissionValues = { ...values };

  const birthday = findLeadershipBirthday(next);
  if (birthday) {
    next.birthday = birthday;

    // Prevent wrong biodata mapping like bio="28-01".
    if (normalizeDayMonth(next.bio)) {
      delete next.bio;
    }
  }

  const anniversaryKeys = [
    'anniversary',
    'wedding_anniversary',
    'weddingAnniversary',
    'marriage_anniversary',
    'marriageAnniversary',
  ];

  let anniversary: string | undefined;

  for (const key of anniversaryKeys) {
    anniversary = normalizeFullDate(next[key]);
    if (anniversary) break;
  }

  if (anniversary) {
    next.anniversary = anniversary;
    next.wedding_anniversary = anniversary;
    next.weddingAnniversary = anniversary;
  } else {
    for (const key of anniversaryKeys) {
      if (typeof next[key] === 'string' && String(next[key]).trim()) {
        delete next[key];
      }
    }
  }

  const role =
    normalizeLeadershipRole(next.role) ||
    normalizeLeadershipRole(next.leadership_role) ||
    normalizeLeadershipRole(next.leadershipRole);

  if (role) {
    next.role = role;
    next.leadership_role = role;
    next.leadershipRole = role;
  }

  return next;
}

type UploadKind = 'image' | 'video' | 'audio' | 'document' | 'file';
type FieldValue = string | boolean | number | string[] | File | null;
type ValuesState = Record<string, FieldValue>;
type SuccessDetail = { label: string; value: string };
type ContentSectionView = {
  title: string;
  subtitle: string;
  items: string[];
  itemSubtexts: string[];
};

type PublicFormClientProps = {
  slug: string;
};

const MB = 1024 * 1024;
const DEFAULT_UPLOAD_LIMIT_MB: Record<UploadKind, number> = {
  image: 5,
  video: 100,
  audio: 50,
  document: 20,
  file: 25,
};
const ACCEPTED_UPLOAD_TYPES: Record<UploadKind, string[]> = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  video: ['video/mp4', 'video/quicktime', 'video/webm'],
  audio: ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/ogg'],
  document: [
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  file: [],
};
const ACCEPTED_UPLOAD_EXTENSIONS: Record<UploadKind, string[]> = {
  image: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
  video: ['.mp4', '.mov', '.webm'],
  audio: ['.mp3', '.m4a', '.wav', '.webm', '.ogg'],
  document: ['.pdf', '.txt', '.csv', '.doc', '.docx', '.xls', '.xlsx'],
  file: [],
};
const FETCH_TIMEOUT_MS = 12000; // give backend time; avoid false negatives
const RETRY_BASE_MS = 1200;
const RETRY_MAX_MS = 6000;
const MAX_FETCH_ATTEMPTS = 3;

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// E.164: + plus 8-15 digits (basic)
const e164Re = /^\+[1-9]\d{7,14}$/;
const PRAYER_REQUEST_WORD_LIMIT = 400;
const MONTH_OPTIONS = [
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
] as const;

const normalizeFieldType = (value?: string) => (value || '').toLowerCase();
const normalizeTypeToken = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const isTextareaType = (value: string) => value === 'textarea' || value === 'text_area' || value === 'multiline';
const isSelectType = (value: string) => value === 'select' || value === 'dropdown';
const isRadioType = (value: string) =>
  value === 'radio' || value === 'radio_group' || value === 'radio_button' || value === 'radio_buttons';
const isCheckboxType = (value: string) =>
  value === 'checkbox' || value === 'checkboxes' || value === 'check_box' || value === 'multi_select';
const isUploadType = (value: string) =>
  value === 'image' ||
  value === 'file' ||
  value === 'upload' ||
  value === 'video' ||
  value === 'audio' ||
  value === 'document';
const isImageType = isUploadType;
const getFieldText = (field: FormField) => `${field.type} ${field.key} ${field.label}`.toLowerCase();
const inferUploadKindFromField = (field: FormField): UploadKind => {
  const hay = getFieldText(field);
  if (/\b(image|photo|picture|passport|headshot|avatar|banner|thumbnail)\b/.test(hay)) return 'image';
  if (/\b(video|reel|mp4|mov|webm)\b/.test(hay)) return 'video';
  if (/\b(audio|voice|sermon|mp3|m4a|wav)\b/.test(hay)) return 'audio';
  if (/\b(document|pdf|doc|docx|xls|xlsx|csv|resume|cv|attachment)\b/.test(hay)) return 'document';
  return 'file';
};
const inferUploadKindFromFile = (file: File, field: FormField): UploadKind => {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  if (
    file.type === 'application/pdf' ||
    file.type.startsWith('text/') ||
    file.type.includes('word') ||
    file.type.includes('excel') ||
    file.type.includes('spreadsheet')
  ) {
    return 'document';
  }
  return inferUploadKindFromField(field);
};
const getUploadLimitMb = (field: FormField, kind: UploadKind) => {
  const configuredMax = field.validation?.max;
  if (typeof configuredMax === 'number' && configuredMax > 0) {
    return configuredMax > 512 ? Math.ceil(configuredMax / MB) : configuredMax;
  }
  return DEFAULT_UPLOAD_LIMIT_MB[kind];
};
const getUploadAccept = (kind: UploadKind) => {
  const values = [...ACCEPTED_UPLOAD_TYPES[kind], ...ACCEPTED_UPLOAD_EXTENSIONS[kind]];
  return values.length > 0 ? values.join(',') : undefined;
};
const getUploadFormatLabel = (kind: UploadKind) => {
  const extensions = ACCEPTED_UPLOAD_EXTENSIONS[kind];
  return extensions.length > 0 ? extensions.join(', ') : 'common file types';
};

const phoneTypeTokens = new Set([
  'tel',
  'phone',
  'mobile',
  'contact',
  'phonenumber',
  'contactnumber',
  'mobilenumber',
  'telephonenumber',
  'telnumber',
  'telephone',
]);
const isPhoneType = (value: string) => {
  const normalized = normalizeFieldType(value);
  if (!normalized) return false;
  if (normalized === 'tel' || normalized === 'phone' || normalized === 'mobile' || normalized === 'contact') return true;
  return phoneTypeTokens.has(normalizeTypeToken(normalized));
};
const isPhoneLikeField = (field: FormField) => {
  const hay = `${field.key} ${field.label}`.toLowerCase();
  return /(phone|mobile|tel|telephone|contact[-_\s]?number)/.test(hay);
};

const pad2 = (value: number) => value.toString().padStart(2, '0');
const daysInMonth = (month: number) => {
  if (month === 2) return 29;
  if ([4, 6, 9, 11].includes(month)) return 30;
  return 31;
};
const parseDDMM = (value: string): { day: string; month: string } | null => {
  if (!value) return null;
  const match = /^(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(month)) return null;
  return { day: match[1], month: match[2] };
};
const parseDDMMPartial = (value: string): { day: string; month: string } | null => {
  if (!value) return null;
  const match = /^(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const day = match[1];
  const month = match[2];
  if (month !== '00' && (Number(month) < 1 || Number(month) > 12)) return null;
  if (day !== '00' && (Number(day) < 1 || Number(day) > 31)) return null;
  return { day, month };
};
const toDDMM = (day: string, month: string) => {
  if (!day && !month) return '';
  if (!day) return `00-${month}`;
  if (!month) return `${day}-00`;
  return `${day}-${month}`;
};
const formatDate = (value?: string, format?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const day = pad2(date.getDate());
  const month = pad2(date.getMonth() + 1);
  const year = date.getFullYear();

  switch (format) {
    case 'dd-mm':
      return `${day}-${month}`;
    case 'mm/dd/yyyy':
      return `${month}/${day}/${year}`;
    case 'dd/mm/yyyy':
      return `${day}/${month}/${year}`;
    case 'dd/mm':
      return `${day}/${month}`;
    default:
      return `${day}-${month}`;
  }
};


function isAnniversaryField(field: FormField): boolean {
  const hay = `${field.key} ${field.label}`.toLowerCase();
  return /(anniversary|wedding|marriage)/.test(hay);
}

function isValidFullDateParts(day: number, month: number, year: number): boolean {
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return false;
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > daysInMonth(month)) return false;

  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function normalizeFullDate(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;

  let match = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    if (!isValidFullDateParts(day, month, year)) return undefined;

    return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
  }

  match = trimmed.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);

    if (!isValidFullDateParts(day, month, year)) return undefined;

    return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
  }

  return undefined;
}

function toHtmlDateInputValue(value: unknown): string {
  const normalized = normalizeFullDate(value);
  if (!normalized) return '';

  const [day, month, year] = normalized.split('/');
  return `${year}-${month}-${day}`;
}

function fromHtmlDateInputValue(value: string): string {
  return normalizeFullDate(value) || '';
}

function isFileValue(value: unknown): value is File {
  return typeof File !== 'undefined' && value instanceof File;
}



function buildInitialValues(formFields: FormField[]): ValuesState {
  const init: ValuesState = {};
  formFields.forEach((f) => {
    const fieldType = normalizeFieldType(f.type);
    const hasOptions = Array.isArray(f.options) && f.options.length > 0;

    if (isImageType(fieldType)) {
      init[f.key] = null;
      return;
    }
    if (isCheckboxType(fieldType) && hasOptions) {
      init[f.key] = [];
      return;
    }
    if (isCheckboxType(fieldType)) {
      init[f.key] = false;
      return;
    }
    init[f.key] = '';
  });
  return init;
}

function toComparableNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return null;
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a == null || b == null) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => valuesEqual(item, b[index]));
  }

  if (typeof a === 'boolean' && typeof b === 'boolean') {
    return a === b;
  }

  if (typeof a === 'string' && typeof b === 'string') {
    return a.trim() === b.trim();
  }

  const leftNumber = toComparableNumber(a);
  const rightNumber = toComparableNumber(b);
  if (leftNumber !== null && rightNumber !== null) {
    return leftNumber === rightNumber;
  }

  return String(a) === String(b);
}

function countWords(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function isPrayerRequestField(field: FormField): boolean {
  const hay = `${field.key} ${field.label}`.toLowerCase();
  return /prayer[-_\s]*request/.test(hay);
}

function valueInList(value: unknown, list?: unknown[]): boolean {
  if (!Array.isArray(list) || list.length === 0) return false;
  if (Array.isArray(value)) {
    return value.some((entry) => list.some((item) => valuesEqual(entry, item)));
  }
  return list.some((item) => valuesEqual(value, item));
}

function isFieldVisible(field: FormField, values: ValuesState): boolean {
  const visibility = field.visibility;
  const rules = visibility?.rules?.filter((rule) => rule?.fieldKey?.trim()) ?? [];
  if (rules.length === 0) return true;

  const evaluateRule = (rule: { fieldKey: string; operator: string; value?: unknown; values?: unknown[] }) => {
    const fieldKey = rule.fieldKey.trim();
    const currentValue = values[fieldKey];
    const operator = rule.operator || 'equals';

    if (operator === 'is_empty') {
      if (Array.isArray(currentValue)) return currentValue.length === 0;
      if (typeof currentValue === 'boolean') return currentValue === false;
      return !String(currentValue ?? '').trim();
    }
    if (operator === 'not_empty') {
      if (Array.isArray(currentValue)) return currentValue.length > 0;
      if (typeof currentValue === 'boolean') return currentValue === true;
      return Boolean(String(currentValue ?? '').trim());
    }

    switch (operator) {
      case 'equals':
        return valuesEqual(currentValue, rule.value);
      case 'not_equals':
        return !valuesEqual(currentValue, rule.value);
      case 'contains':
        if (Array.isArray(currentValue)) {
          return currentValue.some((item) => valuesEqual(item, rule.value));
        }
        return String(currentValue ?? '').toLowerCase().includes(String(rule.value ?? '').toLowerCase());
      case 'not_contains':
        if (Array.isArray(currentValue)) {
          return !currentValue.some((item) => valuesEqual(item, rule.value));
        }
        return !String(currentValue ?? '').toLowerCase().includes(String(rule.value ?? '').toLowerCase());
      case 'in':
        return valueInList(currentValue, rule.values);
      case 'not_in':
        return !valueInList(currentValue, rule.values);
      case 'greater_than':
        return toComparableNumber(currentValue) !== null &&
          toComparableNumber(rule.value) !== null &&
          Number(toComparableNumber(currentValue)) > Number(toComparableNumber(rule.value));
      case 'less_than':
        return toComparableNumber(currentValue) !== null &&
          toComparableNumber(rule.value) !== null &&
          Number(toComparableNumber(currentValue)) < Number(toComparableNumber(rule.value));
      default:
        return false;
    }
  };

  if (visibility?.match === 'any') {
    return rules.some(evaluateRule);
  }

  return rules.every(evaluateRule);
}

const COUNTRY_PHONE_CODES = [
  { iso: 'NG', name: 'Nigeria', dial: '+234' },
  { iso: 'GH', name: 'Ghana', dial: '+233' },
  { iso: 'KE', name: 'Kenya', dial: '+254' },
  { iso: 'ZA', name: 'South Africa', dial: '+27' },
  { iso: 'US', name: 'United States', dial: '+1' },
  { iso: 'CA', name: 'Canada', dial: '+1' },
  { iso: 'GB', name: 'United Kingdom', dial: '+44' },
  { iso: 'FR', name: 'France', dial: '+33' },
  { iso: 'DE', name: 'Germany', dial: '+49' },
  { iso: 'ES', name: 'Spain', dial: '+34' },
] as const;

function onlyDigits(value: string) {
  return value.replace(/\D/g, '');
}

function splitE164(value: string): { dial: string; national: string } | null {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith('+')) return null;

  const candidates = COUNTRY_PHONE_CODES.map((c) => c.dial).sort((a, b) => b.length - a.length);
  const dial = candidates.find((d) => trimmed.startsWith(d));
  if (!dial) return null;

  const rest = trimmed.slice(dial.length);
  return { dial, national: rest.replace(/\D/g, '') };
}

function formatPrettyPhone(e164: string): string {
  if (!e164 || typeof e164 !== 'string') return '';
  const s = e164.trim();
  if (!s.startsWith('+')) return s;

  const parsed = splitE164(s);
  if (!parsed) return s;

  const digits = parsed.national;
  const groups: string[] = [];
  for (let i = 0; i < digits.length; i += 3) groups.push(digits.slice(i, i + 3));
  return `${parsed.dial} ${groups.join(' ')}`.trim();
}

function PhoneNumberInput({
  label,
  required,
  value,
  onChange,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (next: string) => void;
}) {
  const inputClass =
    'w-full rounded-lg border border-[var(--color-border-primary)] px-3 py-2 text-sm bg-[var(--color-background-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent [&>option]:bg-white [&>option]:text-black';
  const selectClass =
    'w-full rounded-lg border border-[var(--color-border-primary)] px-3 py-2 text-sm bg-white text-black focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent';

  const parsed = splitE164(value);
  const currentDial = parsed?.dial ?? COUNTRY_PHONE_CODES[0].dial;
  const currentNational = parsed?.national ?? (value.startsWith('+') ? onlyDigits(value) : onlyDigits(value));

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-2">
        <select
          className={selectClass}
          value={currentDial}
          onChange={(e) => {
            const nextDial = e.target.value;
            const next = `${nextDial}${onlyDigits(currentNational)}`;
            onChange(next);
          }}
          aria-label={`${label} country code`}
        >
          {COUNTRY_PHONE_CODES.map((c) => (
            <option key={c.iso} value={c.dial}>
              {c.name} ({c.dial})
            </option>
          ))}
        </select>

        <input
          className={inputClass}
          inputMode="tel"
          placeholder="Phone number"
          value={currentNational}
          onChange={(e) => {
            const national = onlyDigits(e.target.value);
            const next = `${currentDial}${national}`;
            onChange(next);
          }}
          required={required}
        />
      </div>

      <div className="text-[11px] text-gray-500">
        Stored as international format (E.164), e.g. <span className="font-medium">+2348012345678</span>
      </div>
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: FieldValue | undefined;
  onChange: (next: FieldValue) => void;
}) {
  const inputClass =
    'w-full rounded-lg border border-[var(--color-border-primary)] px-3 py-2 text-sm bg-[var(--color-background-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent [&>option]:bg-white [&>option]:text-black';
  const selectClass =
    'w-full rounded-lg border border-[var(--color-border-primary)] px-3 py-2 text-sm bg-white text-black focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent';
  const options = Array.isArray(field.options) ? field.options : [];
  const normalizedType = normalizeFieldType(field.type);

  const showAsTextarea = isTextareaType(normalizedType);
  const showAsSelect = isSelectType(normalizedType);
  const showAsRadio = isRadioType(normalizedType);
  const showAsCheckbox = isCheckboxType(normalizedType);
  const showAsImage = isImageType(normalizedType);
  const inferredPhone =
    isPhoneLikeField(field) && !showAsTextarea && !showAsSelect && !showAsRadio && !showAsCheckbox && !showAsImage;
  const showAsPhone = isPhoneType(normalizedType) || inferredPhone;

  const checkboxClass =
    'h-4 w-4 rounded border-gray-300 text-yellow-600 focus:ring-yellow-500 appearance-auto accent-[var(--color-accent-primary)]';
  const radioClass =
    'h-4 w-4 rounded-full border-gray-300 text-yellow-600 focus:ring-yellow-500 appearance-auto accent-[var(--color-accent-primary)]';

  if (showAsTextarea) {
    return (
        <textarea
        className={inputClass}
        rows={4}
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.label}
        required={field.required}
      />
    );
  }

  if (showAsSelect) {
    return (
      <select
        className={selectClass}
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        required={field.required}
      >
        <option value="">Select...</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  if (showAsRadio) {
    return (
      <div className="space-y-2">
        {options.map((opt) => (
          <label key={opt.value} className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="radio"
              name={field.key}
              value={opt.value}
              checked={value === opt.value}
              onChange={(e) => onChange(e.target.value)}
              className={radioClass}
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
    );
  }

  if (showAsCheckbox && options.length > 0) {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className="space-y-2">
        {options.map((opt) => {
          const checked = selected.includes(opt.value);
          return (
            <label key={opt.value} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => {
                  if (e.target.checked) onChange([...selected, opt.value]);
                  else onChange(selected.filter((v) => v !== opt.value));
                }}
                className={checkboxClass}
              />
              <span>{opt.label}</span>
            </label>
          );
        })}
      </div>
    );
  }

  if (showAsCheckbox) {
    return (
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className={checkboxClass}
        />
        <span>{field.label}</span>
      </label>
    );
  }

  if (showAsImage) {
    const selected = isFileValue(value) ? value : null;
    const fileKey = selected ? `${selected.name}-${selected.lastModified}` : 'empty';
    const kind = selected ? inferUploadKindFromFile(selected, field) : inferUploadKindFromField(field);
    const maxMb = getUploadLimitMb(field, kind);
    return (
      <div className="space-y-2">
        <input
          key={fileKey}
          type="file"
          accept={getUploadAccept(kind)}
          className={inputClass}
          onChange={(e) => onChange(e.target.files?.[0] || null)}
          required={field.required}
        />
        <div className="text-xs text-gray-500">
          Accepted formats: {getUploadFormatLabel(kind)} (max {maxMb}MB)
        </div>
        {selected ? (
          <div className="text-xs text-gray-700">
            Selected: {selected.name} ({Math.round(selected.size / 1024)} KB)
          </div>
        ) : null}
      </div>
    );
  }

  if (showAsPhone) {
    return (
      <PhoneNumberInput
        label={field.label || 'Phone'}
        required={field.required}
        value={typeof value === 'string' ? value : ''}
        onChange={(next) => onChange(next)}
      />
    );
  }

  if (normalizedType === 'date' && isAnniversaryField(field)) {
    return (
      <input
        type="date"
        className={inputClass}
        value={toHtmlDateInputValue(typeof value === 'string' ? value : '')}
        onChange={(e) => onChange(fromHtmlDateInputValue(e.target.value))}
        required={field.required}
      />
    );
  }

  if (normalizedType === 'date' && isAnniversaryField(field)) {
    return (
      <input
        type="date"
        className={inputClass}
        value={toHtmlDateInputValue(typeof value === 'string' ? value : '')}
        onChange={(e) => onChange(fromHtmlDateInputValue(e.target.value))}
        required={field.required}
      />
    );
  }

  if (normalizedType === 'date') {
    const parsed = parseDDMMPartial(typeof value === 'string' ? value : '');
    const selectedMonth = parsed?.month && parsed.month !== '00' ? parsed.month : '';
    const selectedDay = parsed?.day && parsed.day !== '00' ? parsed.day : '';
    const monthNumber = Number(selectedMonth || '0');
    const maxDay = monthNumber >= 1 && monthNumber <= 12 ? daysInMonth(monthNumber) : 31;
    const dayOptions = Array.from({ length: maxDay }, (_, index) => String(index + 1).padStart(2, '0'));

    return (
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <select
          className={selectClass}
          value={selectedDay}
          disabled={!selectedMonth}
          onChange={(e) => {
            const nextDay = e.target.value;
            onChange(toDDMM(nextDay, selectedMonth));
          }}
          required={field.required}
        >
          <option value="">Select day</option>
          {dayOptions.map((day) => (
            <option key={day} value={day}>
              {day}
            </option>
          ))}
        </select>

        <select
          className={selectClass}
          value={selectedMonth}
          onChange={(e) => {
            const nextMonth = e.target.value;
            const nextMax = daysInMonth(Number(nextMonth || '1'));
            let nextDay = selectedDay;

            if (nextDay && Number(nextDay) > nextMax) {
              nextDay = String(nextMax).padStart(2, '0');
            }

            onChange(toDDMM(nextDay, nextMonth));
          }}
          required={field.required}
        >
          <option value="">Select month</option>
          {MONTH_OPTIONS.map((month) => (
            <option key={month.value} value={month.value}>
              {month.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  const inputType =
    normalizedType === 'email'
      ? 'email'
      : normalizedType === 'number'
      ? 'number'
      : normalizedType === 'date'
      ? 'date'
      : 'text';

  return (
    <input
      type={inputType}
      className={inputClass}
      value={typeof value === 'string' ? value : ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.label}
      required={field.required}
    />
  );
}

async function fetchPublicFormClient(slug: string): Promise<PublicFormPayload | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`/api/v1/forms/${encodeURIComponent(slug)}`, {
      method: 'GET',
      credentials: 'include',
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: PublicFormPayload } | PublicFormPayload;
    const payload = 'data' in json ? json.data ?? null : (json as PublicFormPayload);
    return payload?.form ? payload : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export default function PublicFormClient({ slug }: PublicFormClientProps) {
  const searchParams = useSearchParams();
  const [payload, setPayload] = useState<PublicFormPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const leftRef = useRef<HTMLDivElement | null>(null);
  const rightRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const fieldsRef = useRef<FormField[]>([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [values, setValues] = useState<ValuesState>(() => buildInitialValues([]));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});
  const [formError, setFormError] = useState('');
  const [successOpen, setSuccessOpen] = useState(false);
  const [successDetails, setSuccessDetails] = useState<SuccessDetail[]>([]);
  const [successTokens, setSuccessTokens] = useState<Record<string, string>>({});
  const [shouldAutoReturn, setShouldAutoReturn] = useState(false);

  // ✅ FIX: memoize fields so it doesn't become a new [] every render
  const fields = useMemo<FormField[]>(() => {
    return payload?.form?.fields ?? [];
  }, [payload]);
  const sortedFields = useMemo<FormField[]>(() => {
    return fields.slice().sort((a, b) => a.order - b.order);
  }, [fields]);
  useEffect(() => {
    fieldsRef.current = sortedFields;
  }, [sortedFields]);
  const visibleFields = useMemo<FormField[]>(() => {
    return sortedFields.filter((field) => isFieldVisible(field, values));
  }, [sortedFields, values]);

  const settings = payload?.form?.settings;
  const returnTo = (searchParams.get('return_to') || '').trim();
  const returnDelayMs = useMemo(() => {
    const raw = Number(searchParams.get('return_delay_ms') || 1800);
    if (Number.isNaN(raw)) return 1800;
    return Math.max(600, Math.min(12000, raw));
  }, [searchParams]);

  const hasAutoReturnTarget = Boolean(returnTo);

  const redirectToReturnUrl = useCallback(() => {
    if (!returnTo || typeof window === 'undefined') return;
    window.location.assign(returnTo);
  }, [returnTo]);

  useEffect(() => {
    if (!successOpen || !shouldAutoReturn || !hasAutoReturnTarget) return;
    const timer = setTimeout(() => {
      redirectToReturnUrl();
    }, returnDelayMs);
    return () => clearTimeout(timer);
  }, [hasAutoReturnTarget, redirectToReturnUrl, returnDelayMs, shouldAutoReturn, successOpen]);

  const updateValue = (key: string, next: FieldValue) => {
    setValues((prev) => ({ ...prev, [key]: next }));
    if (formError) setFormError('');
  };

  // ✅ Now this is stable because `fields` is stable via useMemo
  const resetFormState = useCallback(
    (formFields?: FormField[]) => {
      const nextFields = formFields ?? fieldsRef.current;
      setValues(buildInitialValues(nextFields));
      setFieldErrors({});
      setTouchedFields({});
      setFormError('');
    },
    []
  );

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }

    let alive = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const fetchWithRetry = async (attempt: number) => {
      if (!alive) return;

      setLoading(true);
      setRetrying(attempt > 1);
      setLoadError(attempt > 1 ? 'Refreshing the latest form fields…' : null);

      try {
        const res = await fetchPublicFormClient(slug);
        if (!alive) return;

        if (res?.form) {
          setPayload(res);
          resetFormState(res.form.fields ?? []);
          setSuccessOpen(false);
          setSuccessDetails([]);
          setSuccessTokens({});
          setLoading(false);
          setRetrying(false);
          setLoadError(null);
          return;
        }
      } catch (err) {
        console.error(err);
      }

      if (!alive) return;

      if (attempt < MAX_FETCH_ATTEMPTS) {
        const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * attempt);
        timeoutId = setTimeout(() => {
          void fetchWithRetry(attempt + 1);
        }, delay);
        return;
      }

      setLoadError('Unable to load this form right now. Please refresh and try again.');

      setLoading(false);
      setRetrying(false);
    };

    void fetchWithRetry(1);

    return () => {
      alive = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [resetFormState, slug]);

  const valueToString = (value: FieldValue): string => {
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'boolean') return value ? 'Yes' : '';
    if (Array.isArray(value)) return value.join(', ');
    if (isFileValue(value)) return value.name;
    return '';
  };

  const fieldMatches = (field: FormField, keywords: string[]) => {
    const hay = `${field.key} ${field.label}`.toLowerCase();
    return keywords.some((keyword) => hay.includes(keyword));
  };

  const findValueByKeywords = (keywords: string[], sourceValues: ValuesState) => {
    const match = fields.find((field) => {
      if (!fieldMatches(field, keywords)) return false;
      const val = valueToString(sourceValues[field.key]);
      return Boolean(val);
    });
    return match ? valueToString(sourceValues[match.key]) : '';
  };

  const formatEventDate = (value?: string) => formatDate(value, settings?.dateFormat);

  const buildSuccessTokens = (sourceValues: ValuesState) => {
    const formTitle = payload?.form?.title ?? '';
    const eventTitle = payload?.event?.title ?? formTitle;
    const eventDate = formatEventDate(payload?.event?.date);
    const eventTime = payload?.event?.time ?? '';
    const eventLocation = payload?.event?.location ?? '';
    const name = findValueByKeywords(['full name', 'name'], sourceValues);
    const email = findValueByKeywords(['email'], sourceValues);

    const phoneRaw = findValueByKeywords(['phone', 'mobile', 'tel', 'contact', 'contactnumber'], sourceValues);
    const phone = phoneRaw ? formatPrettyPhone(phoneRaw) : '';

    return { formTitle, eventTitle, eventDate, eventTime, eventLocation, name, email, phone };
  };

  const applyTemplate = (template: string, tokens: Record<string, string>) =>
    template
      .replace(/{{\s*([\w.-]+)\s*}}/g, (_, key: string) => tokens[key] ?? '')
      .replace(/\s{2,}/g, ' ')
      .trim();

  const validateUploadFile = (field: FormField, file: File): string | null => {
    const kind = inferUploadKindFromFile(file, field);
    const acceptedTypes = ACCEPTED_UPLOAD_TYPES[kind];
    const acceptedExts = ACCEPTED_UPLOAD_EXTENSIONS[kind];
    const maxMb = getUploadLimitMb(field, kind);

    if (acceptedTypes.length > 0 && !acceptedTypes.includes(file.type)) {
      const lowerName = file.name.toLowerCase();
      const extOk = acceptedExts.some((ext) => lowerName.endsWith(ext));
      if (!extOk) {
        return `Unsupported file type. Accepted formats: ${getUploadFormatLabel(kind)}.`;
      }
    }

    if (file.size > maxMb * MB) {
      return `File must be ${maxMb}MB or smaller.`;
    }

    return null;
  };

  const validateFieldValue = (field: FormField, next: FieldValue): string | null => {
    const fieldType = normalizeFieldType(field.type);
    const label = field.label || 'This field';
    const hasOptions = Array.isArray(field.options) && field.options.length > 0;
    const isPhoneField = isPhoneType(fieldType) || isPhoneLikeField(field);

    if (isImageType(fieldType)) {
      if (isFileValue(next)) return validateUploadFile(field, next);
      return field.required ? `${label} is required.` : null;
    }

    if (isCheckboxType(fieldType) && hasOptions) {
      const list = Array.isArray(next) ? next : [];
      if (field.required && list.length === 0) return `${label} is required.`;
      return null;
    }

    if (isCheckboxType(fieldType)) {
      if (field.required && next !== true) return `${label} is required.`;
      return null;
    }

    const raw = typeof next === 'string' ? next.trim() : '';
    if (!raw) return field.required ? `${label} is required.` : null;

    if (fieldType === 'email' && !emailRe.test(raw)) return 'Please enter a valid email address.';

    if (isPrayerRequestField(field) && countWords(raw) > PRAYER_REQUEST_WORD_LIMIT) {
      return `Prayer request cannot exceed ${PRAYER_REQUEST_WORD_LIMIT} words.`;
    }

    if (isPhoneField) {
      if (!e164Re.test(raw)) return 'Please enter a valid phone number (include country code), e.g. +2348012345678.';
    }

    if (fieldType === 'number' && Number.isNaN(Number(raw))) return 'Please enter a valid number.';

    if (fieldType === 'date') {
      if (isAnniversaryField(field)) {
        return normalizeFullDate(raw)
          ? null
          : 'Please enter a valid anniversary date in DD/MM/YYYY format.';
      }

      if (!parseDDMM(raw)) return 'Please enter a valid date in DD-MM format (e.g. 24-12).';
    }

    return null;
  };

  const updateFieldValue = (field: FormField, next: FieldValue) => {
    const fieldType = normalizeFieldType(field.type);
    setTouchedFields((prev) => (prev[field.key] ? prev : { ...prev, [field.key]: true }));

    if (isImageType(fieldType) && isFileValue(next)) {
      const error = validateUploadFile(field, next);
      if (error) {
        setValues((prev) => ({ ...prev, [field.key]: null }));
        setFieldErrors((prev) => ({ ...prev, [field.key]: error }));
        return;
      }
    }

    const error = validateFieldValue(field, next);
    setFieldErrors((prev) => {
      if (!error && !prev[field.key]) return prev;
      const nextErrors = { ...prev };
      if (error) nextErrors[field.key] = error;
      else delete nextErrors[field.key];
      return nextErrors;
    });

    updateValue(field.key, next);
  };

  const formTitle = payload?.form?.title?.trim() || 'Form';
  const normalizedFormType = (settings?.formType || 'registration').trim().toLowerCase();
  const formTypeLabelMap: Record<string, string> = {
    registration: 'REGISTRATION',
    event: 'EVENT',
    membership: 'MEMBERSHIP',
    workforce: 'WORKFORCE',
    leadership: 'LEADERSHIP',
    application: 'APPLICATION',
    contact: 'CONTACT',
    general: 'FORM',
  };
  const formTypeLabel = formTypeLabelMap[normalizedFormType] || 'FORM';
  const pageHeaderTitle = `${formTypeLabel} - ${formTitle}`;
  const eventTitle = payload?.event?.title ?? formTitle;
  const bannerUrl = settings?.design?.coverImageUrl || payload?.event?.bannerImage || payload?.event?.image || undefined;
  const eventSessions = useMemo(
    () =>
      Array.isArray(payload?.event?.sessions)
        ? payload.event.sessions.filter((session) => session.title?.trim() || session.time?.trim())
        : [],
    [payload?.event?.sessions]
  );

  const introBullets = useMemo(() => {
    if (Array.isArray(settings?.introBullets)) {
      const configured = settings.introBullets.map((item) => item.trim()).filter(Boolean);
      if (configured.length > 0) return configured;
    }

    if (eventSessions.length > 0) {
      return eventSessions
        .map((session) => session.title?.trim())
        .filter((item): item is string => Boolean(item));
    }

    const tags = payload?.event?.tags?.map((item) => item.trim()).filter(Boolean) ?? [];
    if (tags.length > 0) return tags.slice(0, 5);

    return [];
  }, [eventSessions, payload, settings]);

  const introBulletSubs = useMemo(() => {
    if (Array.isArray(settings?.introBulletSubtexts)) {
      const configured = settings.introBulletSubtexts.map((item) => item.trim());
      if (configured.some(Boolean)) return configured;
    }

    if (eventSessions.length > 0) {
      return eventSessions.map((session) => session.time?.trim() || '');
    }

    return [];
  }, [eventSessions, settings]);

  const contentSections = useMemo<ContentSectionView[]>(() => {
    const configured = Array.isArray(settings?.contentSections)
      ? settings.contentSections
          .map((section) => {
            const title = section?.title?.trim() || '';
            const subtitle = section?.subtitle?.trim() || '';
            const items = Array.isArray(section?.items)
              ? section.items.map((item) => item.trim()).filter(Boolean)
              : [];
            const itemSubtexts = Array.isArray(section?.itemSubtexts)
              ? section.itemSubtexts.map((item) => item.trim())
              : [];

            if (!title && !subtitle && items.length === 0 && !itemSubtexts.some(Boolean)) {
              return null;
            }

            return { title, subtitle, items, itemSubtexts };
          })
          .filter((section): section is ContentSectionView => Boolean(section))
      : [];

    if (configured.length > 0) {
      return configured;
    }

    const fallbackSection = {
      title:
        settings?.introTitle?.trim() ||
        (eventSessions.length > 0 ? 'Session Schedule' : introBullets.length > 0 ? 'Form Details' : ''),
      subtitle:
        settings?.introSubtitle?.trim() ||
        payload?.form?.description?.trim() ||
        payload?.event?.shortDescription?.trim() ||
        '',
      items: introBullets,
      itemSubtexts: introBulletSubs,
    };

    return fallbackSection.title || fallbackSection.subtitle || fallbackSection.items.length > 0
      ? [fallbackSection]
      : [];
  }, [
    eventSessions.length,
    introBulletSubs,
    introBullets,
    payload?.event?.shortDescription,
    payload?.form?.description,
    settings,
  ]);
  const primaryContentSection = contentSections[0];
  const showDetailsColumn = contentSections.length > 0;
  const layoutMode = settings?.layoutMode === 'stack' ? 'stack' : 'split';

  const submitButtonLabel =
    settings?.submitButtonText?.trim() || settings?.design?.ctaButtonLabel?.trim() || 'Submit Registration';
  const privacyCopy = settings?.design?.privacyCopy ?? 'By submitting, you confirm your details are accurate.';
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME?.trim() || 'Registration Portal';
  const siteSubtitle = process.env.NEXT_PUBLIC_SITE_SUBTITLE?.trim() || 'Online registration';
  const siteHomeUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_PUBLIC_URL?.trim() ||
    (typeof window !== 'undefined' && window.location.origin ? window.location.origin : '/');
  const siteLogoSrc = process.env.NEXT_PUBLIC_SITE_LOGO_PATH?.trim() || '/OIP.webp';
  const footerText = settings?.footerText?.trim() || settings?.design?.footerNote?.trim() || siteName;
  const footerStyle = undefined;

  const baseThemeStyle = useMemo<React.CSSProperties>(
    () => ({
      ['--color-accent-primary' as string]: '#eab308',
      ['--color-accent-primaryhover' as string]: '#ca8a04',
      ['--color-accent-primaryactive' as string]: '#a16207',
      ['--color-text-primary' as string]: '#0b0b0b',
      ['--color-text-secondary' as string]: '#111827',
      ['--color-text-tertiary' as string]: '#4b5563',
      ['--color-text-onprimary' as string]: '#0b0b0b',
      ['--color-background-primary' as string]: '#ffffff',
      ['--color-background-secondary' as string]: '#f8fafc',
      ['--color-background-tertiary' as string]: '#f1f5f9',
      ['--color-border-primary' as string]: '#e5e7eb',
      ['--color-border-secondary' as string]: '#d1d5db',
    }),
    []
  );
  const pageThemeStyle = baseThemeStyle;

  const submitButtonIcon = useMemo(() => {
    switch (settings?.submitButtonIcon) {
      case 'check':
        return <Check className="h-4 w-4" />;
      case 'send':
        return <Send className="h-4 w-4" />;
      case 'calendar':
        return <Calendar className="h-4 w-4" />;
      case 'cursor':
        return <MousePointer2 className="h-4 w-4" />;
      default:
        return undefined;
    }
  }, [settings?.submitButtonIcon]);

  const hasLeftColumn = showDetailsColumn;

  const fallbackTokens = buildSuccessTokens(values);
  const tokenSource = Object.keys(successTokens).length > 0 ? successTokens : fallbackTokens;

  const successTitleTemplate = settings?.successTitle || 'Thank you for registering';
  const successSubtitleTemplate = settings?.successSubtitle || 'for {{formTitle}}';
  const successDescriptionTemplate = settings?.successMessage || 'We would love to see you.';

  const successTitle = applyTemplate(successTitleTemplate, tokenSource);
  const successSubtitle = applyTemplate(successSubtitleTemplate, tokenSource);
  const successDescription = applyTemplate(successDescriptionTemplate, tokenSource);

  const parseDate = (value?: string) => {
    if (!value) return null;
    const t = new Date(value);
    return Number.isNaN(t.getTime()) ? null : t;
  };

  const closesAt = parseDate(settings?.closesAt);
  const expiresAt = parseDate(settings?.expiresAt);
  const now = new Date();
  const isClosed = Boolean((closesAt && now > closesAt) || (expiresAt && now > expiresAt));

  const validateClient = (): { isValid: boolean; message: string | null } => {
    const nextErrors: Record<string, string> = {};
    let anyFilled = false;

    visibleFields.forEach((f) => {
      const v = values[f.key];
      const fieldType = normalizeFieldType(f.type);
      const hasOptions = Array.isArray(f.options) && f.options.length > 0;

      const markFilled = () => {
        anyFilled = true;
      };

      if (isImageType(fieldType)) {
        if (isFileValue(v)) markFilled();
      } else if (isCheckboxType(fieldType) && hasOptions) {
        const list = Array.isArray(v) ? v : [];
        if (list.length > 0) markFilled();
      } else if (isCheckboxType(fieldType)) {
        if (v === true) markFilled();
      } else if (typeof v === 'string' && v.trim() !== '') {
        markFilled();
      }

      const error = validateFieldValue(f, v);
      if (error) nextErrors[f.key] = error;
    });

    setTouchedFields((prev) => {
      const next = { ...prev };
      visibleFields.forEach((f) => {
        next[f.key] = true;
      });
      return next;
    });

    setFieldErrors(nextErrors);

    const errorCount = Object.keys(nextErrors).length;
    if (errorCount > 0) {
      const message =
        errorCount === 1
          ? 'Please review the highlighted field and try again.'
          : 'Please review the highlighted fields and try again.';
      setFormError(message);
      return { isValid: false, message };
    }

    if (!anyFilled) {
      const message = 'Please provide at least one response before submitting.';
      setFormError(message);
      return { isValid: false, message };
    }

    setFormError('');
    return { isValid: true, message: null };
  };
  const submit = async () => {
  if (!slug || !payload) return;

  try {
    if (isClosed) {
      toast.error('This registration is closed.');
      return;
    }

    setFormError('');

    const validation = validateClient();
    if (!validation.isValid) {
      toast.error(validation.message || 'Please review the form and try again.');
      return;
    }

    setSubmitting(true);

    const rawValuesPayload: PublicSubmissionValues = {};

    visibleFields.forEach((field) => {
      const value = values[field.key];

      if (value === undefined || value === null) {
        return;
      }

      if (
        (typeof File !== 'undefined' && value instanceof File) ||
        typeof value === 'string' ||
        typeof value === 'boolean' ||
        typeof value === 'number' ||
        Array.isArray(value)
      ) {
        rawValuesPayload[field.key] = value;
      }
    });

    const uploadedValuesPayload = await prepareUploadPayload({
      fields: visibleFields,
      values: rawValuesPayload,
      module: 'public-forms',
      ownerType: 'public-form',
      ownerId: payload.form.id,
      slug,
      folderPrefix: 'public-forms',
      addImageAliases: shouldNormalizeLeadershipValues(slug),
    });

    const normalizedValuesPayload = await prepareLeadershipPublicSubmissionValues(
      slug,
      uploadedValuesPayload
    );


    await apiClient.submitPublicForm(slug, {
      values: normalizedValuesPayload,
    });

    setSuccessTokens(buildSuccessTokens(values));
    setSuccessDetails([]);
    resetFormState();
    setSuccessOpen(true);
    setShouldAutoReturn(hasAutoReturnTarget);
  } catch (err) {
    console.error(err);

    const serverFieldErrors = extractServerFieldErrors(err);
    if (Object.keys(serverFieldErrors).length > 0) {
      setFieldErrors(serverFieldErrors);
      setTouchedFields((prev) => {
        const next = { ...prev };

        Object.keys(serverFieldErrors).forEach((key) => {
          next[key] = true;
        });

        return next;
      });

      toast.error(getFirstServerFieldError(serverFieldErrors) || 'Please review the highlighted fields.');
      return;
    }

    const message = getServerErrorMessage(err, 'Failed to submit registration');
    toast.error(message);
    setFormError(message);
  } finally {
    setSubmitting(false);
  }
};

  if (!slug) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center space-y-3">
        <div className="text-sm text-gray-700">Invalid form link. Please check the URL and try again.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center space-y-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-solid border-yellow-600 border-r-transparent" />
        <div className="text-sm text-gray-600">
          {loadError || (retrying ? 'Connecting… retrying automatically' : 'Loading form…')}
        </div>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="max-w-md rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError || 'Unable to load this form right now.'}
        </div>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className="min-h-screen bg-white text-black transition-opacity duration-500"
      style={pageThemeStyle}
    >
      <header className="border-b border-gray-200 bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href={siteHomeUrl}
            className="flex items-center gap-3"
            aria-label={`${siteName} home`}
            prefetch={false}
          >
            <span className="relative h-10 w-10 overflow-hidden rounded-full border border-gray-200 bg-white">
              <Image src={siteLogoSrc} alt={`${siteName} logo`} fill className="object-cover" sizes="40px" />
            </span>
            <div className="leading-tight">
              <div className="text-sm font-medium text-black">{siteName}</div>
              <div className="text-xs text-gray-500">{siteSubtitle}</div>
            </div>
          </Link>
          <nav className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
            <Link
              href={siteHomeUrl}
              className="rounded-full px-3 py-1 hover:text-black hover:bg-gray-50 transition-colors"
              prefetch={false}
            >
              Home
            </Link>
            <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 shadow-sm">
              Secure form
            </span>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Hero */}
        <div className="mb-8">
          <div className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600 shadow-sm">
            {formTypeLabel}
          </div>

          {bannerUrl ? (
            <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="relative h-48 sm:h-64">
                <Image
                  src={bannerUrl}
                  alt={eventTitle}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 900px"
                  priority
                />
              </div>
            </div>
          ) : null}

          <h1 className="mt-3 text-2xl sm:text-3xl font-black tracking-[0.08em] uppercase text-black">
            {pageHeaderTitle}
          </h1>

          {isClosed ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Registration is closed for this form.
            </div>
          ) : null}
        </div>

        <div
          className={
            hasLeftColumn && layoutMode === 'split'
              ? 'grid gap-6 md:gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,360px)]'
              : 'space-y-6 md:space-y-8'
          }
        >
          <div ref={rightRef}>
            <Card className="p-6 md:p-7 shadow-md transition-shadow duration-300 hover:shadow-lg bg-white border-gray-200">
              {settings?.formHeaderNote ? (
                <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                  {settings.formHeaderNote}
                </p>
              ) : null}

              <div className={settings?.formHeaderNote ? 'mt-4 space-y-4' : 'space-y-4'}>
                {visibleFields.map((field) => {
                  const fieldType = normalizeFieldType(field.type);
                  const checkboxWithOptions =
                    isCheckboxType(fieldType) && Array.isArray(field.options) && field.options.length > 0;
                  const showLabel = !isCheckboxType(fieldType) || checkboxWithOptions;

                  return (
                    <div key={field.key} className="space-y-1.5">
                      {showLabel ? (
                        <label className="block text-sm font-medium text-gray-800">
                          {field.label} {field.required ? <span className="text-red-500">*</span> : null}
                        </label>
                      ) : null}

                      <FieldInput
                        field={field}
                        value={values[field.key]}
                        onChange={(next) => updateFieldValue(field, next)}
                      />

                      {fieldErrors[field.key] && touchedFields[field.key] ? (
                        <p className="text-xs text-red-600">{fieldErrors[field.key]}</p>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <div className="mt-6">
                {formError ? (
                  <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {formError}
                  </div>
                ) : null}

                <Button
                  className="w-full"
                  size="sm"
                  loading={submitting}
                  disabled={submitting || isClosed}
                  onClick={submit}
                  icon={submitButtonIcon}
                >
                  {submitButtonLabel}
                </Button>

                <p className="mt-3 text-xs text-gray-600 text-center">{privacyCopy}</p>
              </div>
            </Card>
          </div>

          {hasLeftColumn ? (
            <div ref={leftRef} className="space-y-6 xl:sticky xl:top-6 self-start">
              {contentSections.map((section, sectionIndex) => (
                <Card
                  key={`${section.title || 'section'}-${sectionIndex}`}
                  className="p-6 transition-shadow duration-300 hover:shadow-md bg-white border-gray-200"
                >
                  {section.title ? (
                    <h2 className="text-base font-medium text-black">{section.title}</h2>
                  ) : null}
                  {section.subtitle ? (
                    <p className="mt-1 text-sm text-gray-600">{section.subtitle}</p>
                  ) : null}

                  {section.items.length > 0 ? (
                    <ul
                      ref={sectionIndex === 0 ? listRef : undefined}
                      className={section.title || section.subtitle ? 'mt-4 space-y-3' : 'space-y-3'}
                    >
                      {section.items.map((item, idx) => {
                        const sub = section.itemSubtexts[idx];
                        return (
                          <li
                            key={`${item}-${idx}`}
                            className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
                          >
                            <div className="mt-1 h-2.5 w-2.5 rounded-full bg-yellow-600" />
                            <div className="text-sm text-gray-800">
                              <div className="font-medium text-black">{item}</div>
                              {sub ? <div className="mt-1 text-xs text-gray-500">{sub}</div> : null}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </Card>
              ))}
            </div>
          ) : null}
        </div>

        <footer className="mt-14 border-t border-gray-200 pt-10" style={footerStyle}>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <div className="text-sm font-medium text-black">{siteName}</div>
              <p className="text-xs text-gray-600">
                {payload.form.description?.trim() ||
                  primaryContentSection?.subtitle ||
                  'Complete the form with accurate details so your registration can be processed correctly.'}
              </p>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium text-black">Form Details</div>
              <ul className="space-y-1 text-xs text-gray-600">
                <li>{payload.event?.title ? `Linked event: ${payload.event.title}` : `Form: ${formTitle}`}</li>
                {closesAt ? <li>Closes: {formatDate(closesAt.toISOString(), settings?.dateFormat)}</li> : null}
                {payload.form.updatedAt ? (
                  <li>Updated: {formatDate(payload.form.updatedAt, settings?.dateFormat)}</li>
                ) : null}
              </ul>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium text-black">Privacy & Accuracy</div>
              <ul className="space-y-1 text-xs text-gray-600">
                <li>{privacyCopy}</li>
                <li>Only authorized staff can review submissions.</li>
                <li>{isClosed ? 'This form is currently closed.' : 'Please complete all required fields before submitting.'}</li>
              </ul>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-2 border-t border-gray-200 pt-4 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
            <span>{footerText}</span>
            <span>© {new Date().getFullYear()} {siteName}. All rights reserved.</span>
          </div>
        </footer>
      </div>

      <SuccessModal
        open={successOpen}
        title={successTitle}
        subtitle={successSubtitle}
        description={successDescription}
        details={successDetails}
        onClose={() => {
          if (hasAutoReturnTarget) {
            redirectToReturnUrl();
            return;
          }
          setShouldAutoReturn(false);
          setSuccessOpen(false);
        }}
        primaryAction={{
          label: hasAutoReturnTarget ? 'Return to website' : 'Done',
          onClick: () => {
            if (hasAutoReturnTarget) {
              redirectToReturnUrl();
              return;
            }
            setShouldAutoReturn(false);
            setSuccessOpen(false);
          },
        }}
        secondaryAction={{
          label: 'Submit another response',
          onClick: () => {
            setShouldAutoReturn(false);
            setSuccessOpen(false);
            resetFormState();
          },
          variant: 'outline',
        }}
      />
    </div>
  );
}
