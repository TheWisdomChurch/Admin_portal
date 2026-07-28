// src/app/forms/[slug]/PublicFormClient.tsx
'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { Calendar, Check, ChevronRight, FileUp, Loader2, MousePointer2, Send, ShieldCheck } from 'lucide-react';

import { prepareUploadPayload } from '@/lib/prepareUploadPayload';
import { apiClient } from '@/lib/api';
import { extractServerFieldErrors, getFirstServerFieldError, getServerErrorMessage } from '@/lib/serverValidation';
import type { FormField, PublicFormPayload, SubmittedFormValue, UploadedFormAssetValue } from '@/lib/types';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { SuccessModal } from '@/ui/SuccessModal';

type UploadKind = 'image' | 'video' | 'audio' | 'document' | 'file';
type FieldValue = string | boolean | number | string[] | File | null;
type ValuesState = Record<string, FieldValue>;
type SuccessDetail = { label: string; value: string };
type PublicSubmissionValue = string | boolean | number | string[] | UploadedFormAssetValue | File | null;
type PublicSubmissionValues = Record<string, PublicSubmissionValue>;
type SubmittedPublicSubmissionValues = Record<string, SubmittedFormValue>;
type ContentSectionView = { title: string; subtitle: string; items: string[]; itemSubtexts: string[] };

type PublicFormClientProps = { slug: string };

const fieldInputClass =
  'w-full min-h-12 rounded-xl border border-stone-300 bg-white px-4 py-3 text-base text-stone-900 shadow-sm outline-none transition placeholder:text-stone-400 hover:border-stone-400 focus:border-amber-600 focus:ring-4 focus:ring-amber-100 disabled:cursor-not-allowed disabled:bg-stone-100 sm:text-sm';
const choiceRowClass =
  'flex cursor-pointer items-start gap-3 rounded-xl border border-stone-200 bg-white p-3.5 text-sm text-stone-700 transition hover:border-amber-300 hover:bg-amber-50/50 has-[:checked]:border-amber-500 has-[:checked]:bg-amber-50';

const MB = 1024 * 1024;
const FETCH_TIMEOUT_MS = 12_000;
const RETRY_BASE_MS = 1_200;
const RETRY_MAX_MS = 6_000;
const MAX_FETCH_ATTEMPTS = 3;
const PRAYER_REQUEST_WORD_LIMIT = 400;
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const e164Re = /^\+[1-9]\d{7,14}$/;

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

const DEFAULT_UPLOAD_LIMIT_MB: Record<UploadKind, number> = { image: 5, video: 100, audio: 50, document: 20, file: 25 };
const ACCEPTED_UPLOAD_TYPES: Record<UploadKind, string[]> = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  video: ['video/mp4', 'video/quicktime', 'video/webm'],
  audio: ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/ogg'],
  document: ['application/pdf', 'text/plain', 'text/csv', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  file: [],
};
const ACCEPTED_UPLOAD_EXTENSIONS: Record<UploadKind, string[]> = {
  image: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
  video: ['.mp4', '.mov', '.webm'],
  audio: ['.mp3', '.m4a', '.wav', '.webm', '.ogg'],
  document: ['.pdf', '.txt', '.csv', '.doc', '.docx', '.xls', '.xlsx'],
  file: [],
};

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
] as const;

function normalizeFieldType(value?: string) {
  return (value || '').toLowerCase();
}
function normalizeTypeToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}
function isTextareaType(value: string) {
  return value === 'textarea' || value === 'text_area' || value === 'multiline';
}
function isSelectType(value: string) {
  return value === 'select' || value === 'dropdown';
}
function isRadioType(value: string) {
  return value === 'radio' || value === 'radio_group' || value === 'radio_button' || value === 'radio_buttons';
}
function isCheckboxType(value: string) {
  return value === 'checkbox' || value === 'checkboxes' || value === 'check_box' || value === 'multi_select';
}
function isUploadType(value: string) {
  return ['image', 'file', 'upload', 'video', 'audio', 'document'].includes(value);
}
function isPhoneType(value: string) {
  const normalized = normalizeFieldType(value);
  if (['tel', 'phone', 'mobile', 'contact'].includes(normalized)) return true;
  return new Set(['tel', 'phone', 'mobile', 'contact', 'phonenumber', 'contactnumber', 'mobilenumber', 'telephonenumber', 'telephone']).has(normalizeTypeToken(normalized));
}
function isPhoneLikeField(field: FormField) {
  return /(phone|mobile|tel|telephone|contact[-_\s]?number)/.test(`${field.key} ${field.label}`.toLowerCase());
}
function isPrayerRequestField(field: FormField) {
  return /prayer[-_\s]*request/.test(`${field.key} ${field.label}`.toLowerCase());
}
function isAnniversaryField(field: FormField) {
  return /(anniversary|wedding|marriage)/.test(`${field.key} ${field.label}`.toLowerCase());
}
// Whether a `date`-type field captures a full date (with year) or only
// day+month. Prefers the explicit `field.validation.dateMode` config so this
// is data-driven going forward. Falls back to the legacy label-text
// heuristic only when no explicit mode is set, so forms created before this
// field existed (mostly wedding/anniversary fields, which were always
// intended to be day-month-only) keep rendering exactly as before. Any
// `date` field that doesn't match that heuristic — including "Date of
// Birth" — now defaults to a full date instead of silently dropping the
// year.
function resolveDateMode(field: FormField): 'full' | 'day-month' {
  const explicit = field.validation?.dateMode;
  if (explicit === 'full' || explicit === 'day-month') return explicit;
  return isAnniversaryField(field) ? 'day-month' : 'full';
}
function isFileValue(value: unknown): value is File {
  return typeof File !== 'undefined' && value instanceof File;
}
function daysInMonth(month: number) {
  if (month === 2) return 29;
  if ([4, 6, 9, 11].includes(month)) return 30;
  return 31;
}
function pad2(value: number) {
  return String(value).padStart(2, '0');
}
function parseDDMM(value: string): { day: string; month: string } | null {
  const match = /^(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(month)) return null;
  return { day: match[1], month: match[2] };
}
function parseDDMMPartial(value: string): { day: string; month: string } | null {
  const match = /^(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const day = match[1];
  const month = match[2];
  if (month !== '00' && (Number(month) < 1 || Number(month) > 12)) return null;
  if (day !== '00' && (Number(day) < 1 || Number(day) > 31)) return null;
  return { day, month };
}
function toDDMM(day: string, month: string) {
  if (!day && !month) return '';
  if (!day) return `00-${month}`;
  if (!month) return `${day}-00`;
  return `${day}-${month}`;
}
function isValidFullDateParts(day: number, month: number, year: number) {
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return false;
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > daysInMonth(month)) return false;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
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
    return isValidFullDateParts(day, month, year) ? `${pad2(day)}/${pad2(month)}/${year}` : undefined;
  }
  match = trimmed.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (!match) return undefined;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  return isValidFullDateParts(day, month, year) ? `${pad2(day)}/${pad2(month)}/${year}` : undefined;
}
function toHtmlDateInputValue(value: unknown): string {
  const normalized = normalizeFullDate(value);
  if (!normalized) return '';
  const [day, month, year] = normalized.split('/');
  return `${year}-${month}-${day}`;
}
function fromHtmlDateInputValue(value: string) {
  return normalizeFullDate(value) || '';
}
function normalizeDayMonth(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.]\d{2,4})?$/);
  if (!match) return undefined;
  let day = Number(match[1]);
  let month = Number(match[2]);
  if (day <= 12 && month > 12) [day, month] = [month, day];
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  return `${pad2(day)}/${pad2(month)}`;
}
function normalizeLeadershipRole(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
  const allowed = new Set(['senior_pastor', 'associate_pastor', 'deacon', 'deaconess', 'reverend']);
  return allowed.has(normalized) ? normalized : undefined;
}
function shouldNormalizeLeadershipValues(slug: string) {
  const normalized = slug.trim().toLowerCase();
  return normalized === 'leadership-biodata' || normalized === 'leadership' || normalized.includes('leadership');
}
function findLeadershipBirthday(values: Record<string, unknown>): string | undefined {
  for (const key of ['birthday', 'birthDay', 'dateOfBirth', 'date_of_birth', 'dob', 'bio']) {
    const normalized = normalizeDayMonth(values[key]);
    if (normalized) return normalized;
  }
  for (const value of Object.values(values)) {
    const normalized = normalizeDayMonth(value);
    if (normalized) return normalized;
  }
  return undefined;
}
async function prepareLeadershipPublicSubmissionValues(slug: string, values: SubmittedPublicSubmissionValues): Promise<SubmittedPublicSubmissionValues> {
  if (!shouldNormalizeLeadershipValues(slug)) return values;
  const next: SubmittedPublicSubmissionValues = { ...values };
  const birthday = findLeadershipBirthday(next);
  if (birthday) {
    next.birthday = birthday;
    if (normalizeDayMonth(next.bio)) delete next.bio;
  }
  let anniversary: string | undefined;
  for (const key of ['anniversary', 'wedding_anniversary', 'weddingAnniversary', 'marriage_anniversary', 'marriageAnniversary']) {
    anniversary = normalizeFullDate(next[key]);
    if (anniversary) break;
  }
  if (anniversary) {
    next.anniversary = anniversary;
    next.wedding_anniversary = anniversary;
    next.weddingAnniversary = anniversary;
  }
  const role = normalizeLeadershipRole(next.role) || normalizeLeadershipRole(next.leadership_role) || normalizeLeadershipRole(next.leadershipRole);
  if (role) {
    next.role = role;
    next.leadership_role = role;
    next.leadershipRole = role;
  }
  return next;
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, '');
}
function splitE164(value: string): { dial: string; national: string } | null {
  if (!value?.startsWith('+')) return null;
  const candidates = COUNTRY_PHONE_CODES.map((c) => c.dial).sort((a, b) => b.length - a.length);
  const dial = candidates.find((d) => value.startsWith(d));
  if (!dial) return null;
  return { dial, national: value.slice(dial.length).replace(/\D/g, '') };
}
function formatPrettyPhone(e164: string): string {
  const parsed = splitE164(e164.trim());
  if (!parsed) return e164;
  const groups: string[] = [];
  for (let i = 0; i < parsed.national.length; i += 3) groups.push(parsed.national.slice(i, i + 3));
  return `${parsed.dial} ${groups.join(' ')}`.trim();
}
function countWords(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}
function toComparableNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.trim());
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}
function valuesEqual(a: unknown, b: unknown): boolean {
  if (a == null || b == null) return false;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((item, index) => valuesEqual(item, b[index]));
  if (typeof a === 'boolean' && typeof b === 'boolean') return a === b;
  if (typeof a === 'string' && typeof b === 'string') return a.trim() === b.trim();
  const left = toComparableNumber(a);
  const right = toComparableNumber(b);
  if (left !== null && right !== null) return left === right;
  return String(a) === String(b);
}
function valueInList(value: unknown, list?: unknown[]) {
  if (!Array.isArray(list) || list.length === 0) return false;
  if (Array.isArray(value)) return value.some((entry) => list.some((item) => valuesEqual(entry, item)));
  return list.some((item) => valuesEqual(value, item));
}
function isFieldVisible(field: FormField, values: ValuesState): boolean {
  const visibility = field.visibility;
  const rules = visibility?.rules?.filter((rule) => rule?.fieldKey?.trim()) ?? [];
  if (rules.length === 0) return true;
  const evaluateRule = (rule: { fieldKey: string; operator: string; value?: unknown; values?: unknown[] }) => {
    const currentValue = values[rule.fieldKey.trim()];
    switch (rule.operator || 'equals') {
      case 'is_empty': return Array.isArray(currentValue) ? currentValue.length === 0 : typeof currentValue === 'boolean' ? currentValue === false : !String(currentValue ?? '').trim();
      case 'not_empty': return Array.isArray(currentValue) ? currentValue.length > 0 : typeof currentValue === 'boolean' ? currentValue === true : Boolean(String(currentValue ?? '').trim());
      case 'equals': return valuesEqual(currentValue, rule.value);
      case 'not_equals': return !valuesEqual(currentValue, rule.value);
      case 'contains': return Array.isArray(currentValue) ? currentValue.some((item) => valuesEqual(item, rule.value)) : String(currentValue ?? '').toLowerCase().includes(String(rule.value ?? '').toLowerCase());
      case 'not_contains': return Array.isArray(currentValue) ? !currentValue.some((item) => valuesEqual(item, rule.value)) : !String(currentValue ?? '').toLowerCase().includes(String(rule.value ?? '').toLowerCase());
      case 'in': return valueInList(currentValue, rule.values);
      case 'not_in': return !valueInList(currentValue, rule.values);
      case 'greater_than': return toComparableNumber(currentValue) !== null && toComparableNumber(rule.value) !== null && Number(toComparableNumber(currentValue)) > Number(toComparableNumber(rule.value));
      case 'less_than': return toComparableNumber(currentValue) !== null && toComparableNumber(rule.value) !== null && Number(toComparableNumber(currentValue)) < Number(toComparableNumber(rule.value));
      default: return false;
    }
  };
  return visibility?.match === 'any' ? rules.some(evaluateRule) : rules.every(evaluateRule);
}
function getFieldText(field: FormField) {
  return `${field.type} ${field.key} ${field.label}`.toLowerCase();
}
function inferUploadKindFromField(field: FormField): UploadKind {
  const hay = getFieldText(field);
  if (/\b(image|photo|picture|passport|headshot|avatar|banner|thumbnail)\b/.test(hay)) return 'image';
  if (/\b(video|reel|mp4|mov|webm)\b/.test(hay)) return 'video';
  if (/\b(audio|voice|sermon|mp3|m4a|wav)\b/.test(hay)) return 'audio';
  if (/\b(document|pdf|doc|docx|xls|xlsx|csv|resume|cv|attachment)\b/.test(hay)) return 'document';
  return 'file';
}
function inferUploadKindFromFile(file: File, field: FormField): UploadKind {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  if (file.type === 'application/pdf' || file.type.startsWith('text/') || file.type.includes('word') || file.type.includes('excel') || file.type.includes('spreadsheet')) return 'document';
  return inferUploadKindFromField(field);
}
function getUploadLimitMb(field: FormField, kind: UploadKind) {
  const configuredMax = field.validation?.max;
  if (typeof configuredMax === 'number' && configuredMax > 0) return configuredMax > 512 ? Math.ceil(configuredMax / MB) : configuredMax;
  return DEFAULT_UPLOAD_LIMIT_MB[kind];
}
function getUploadAccept(kind: UploadKind) {
  const values = [...ACCEPTED_UPLOAD_TYPES[kind], ...ACCEPTED_UPLOAD_EXTENSIONS[kind]];
  return values.length > 0 ? values.join(',') : undefined;
}
function getUploadFormatLabel(kind: UploadKind) {
  const extensions = ACCEPTED_UPLOAD_EXTENSIONS[kind];
  return extensions.length > 0 ? extensions.join(', ') : 'common file types';
}
function buildInitialValues(formFields: FormField[]): ValuesState {
  const init: ValuesState = {};
  formFields.forEach((f) => {
    const type = normalizeFieldType(f.type);
    const hasOptions = Array.isArray(f.options) && f.options.length > 0;
    if (isUploadType(type)) init[f.key] = null;
    else if (isCheckboxType(type) && hasOptions) init[f.key] = [];
    else if (isCheckboxType(type)) init[f.key] = false;
    else init[f.key] = '';
  });
  return init;
}
function formatDate(value?: string, format?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const day = pad2(date.getDate());
  const month = pad2(date.getMonth() + 1);
  const year = date.getFullYear();
  if (format === 'mm/dd/yyyy') return `${month}/${day}/${year}`;
  if (format === 'dd/mm/yyyy') return `${day}/${month}/${year}`;
  if (format === 'dd/mm') return `${day}/${month}`;
  return `${day}-${month}`;
}
function applyTemplate(template: string, tokens: Record<string, string>) {
  return template.replace(/{{\s*([\w.-]+)\s*}}/g, (_, key: string) => tokens[key] ?? '').replace(/\s{2,}/g, ' ').trim();
}

function resolveSafeReturnUrl(rawValue: string): string {
  const raw = rawValue.trim();
  if (!raw || typeof window === 'undefined') return '';
  try {
    const target = new URL(raw, window.location.origin);
    return target.origin === window.location.origin ? target.toString() : '';
  } catch {
    return '';
  }
}

function PhoneNumberInput({ label, required, value, onChange }: { label: string; required?: boolean; value: string; onChange: (next: string) => void }) {
  const parsed = splitE164(value);
  const currentDial = parsed?.dial ?? COUNTRY_PHONE_CODES[0].dial;
  const currentNational = parsed?.national ?? onlyDigits(value);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[180px_1fr]">
        <select className={fieldInputClass} value={currentDial} onChange={(e) => onChange(`${e.target.value}${onlyDigits(currentNational)}`)} aria-label={`${label} country code`}>
          {COUNTRY_PHONE_CODES.map((c) => <option key={c.iso} value={c.dial}>{c.name} ({c.dial})</option>)}
        </select>
        {/* eslint-disable-next-line no-restricted-syntax -- public-form field, see FieldInput's comment */}
        <input className={fieldInputClass} inputMode="tel" placeholder="Phone number" value={currentNational} onChange={(e) => onChange(`${currentDial}${onlyDigits(e.target.value)}`)} required={required} />
      </div>
      <p className="text-xs text-stone-500">Use a number you can currently receive calls or messages on.</p>
    </div>
  );
}

// Uses its own fieldInputClass/choiceRowClass convention (not src/ui/Input) since this renders every public-form input type uniformly, outside the admin design system.
function FieldInput({ field, value, onChange }: { field: FormField; value: FieldValue | undefined; onChange: (next: FieldValue) => void }) {
  const options = Array.isArray(field.options) ? field.options : [];
  const type = normalizeFieldType(field.type);
  const showAsPhone = isPhoneType(type) || (isPhoneLikeField(field) && !isTextareaType(type) && !isSelectType(type) && !isRadioType(type) && !isCheckboxType(type) && !isUploadType(type));

  if (isTextareaType(type)) return <textarea className={`${fieldInputClass} min-h-32 resize-y`} value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} placeholder={`Enter ${field.label.toLowerCase()}`} required={field.required} minLength={field.validation?.minLength} maxLength={field.validation?.maxLength} />;
  if (isSelectType(type)) return <select className={fieldInputClass} value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} required={field.required}><option value="">Select...</option>{options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select>;
  // eslint-disable-next-line no-restricted-syntax -- public-form choice rows, see FieldInput's comment
  if (isRadioType(type)) return <div className="grid gap-2">{options.map((opt) => <label key={opt.value} className={choiceRowClass}><input type="radio" name={field.key} value={opt.value} checked={value === opt.value} onChange={(e) => onChange(e.target.value)} className="accent-[var(--color-accent-primary)]" /><span>{opt.label}</span></label>)}</div>;
  if (isCheckboxType(type) && options.length > 0) {
    const selected = Array.isArray(value) ? value : [];
    // eslint-disable-next-line no-restricted-syntax -- public-form choice rows, see FieldInput's comment
    return <div className="grid gap-2">{options.map((opt) => <label key={opt.value} className={choiceRowClass}><input type="checkbox" checked={selected.includes(opt.value)} onChange={(e) => onChange(e.target.checked ? [...selected, opt.value] : selected.filter((v) => v !== opt.value))} className="accent-[var(--color-accent-primary)]" /><span>{opt.label}</span></label>)}</div>;
  }
  // eslint-disable-next-line no-restricted-syntax -- public-form choice row, see FieldInput's comment
  if (isCheckboxType(type)) return <label className={choiceRowClass}><input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} className="accent-[var(--color-accent-primary)]" /><span>{field.label}</span></label>;
  if (isUploadType(type)) {
    const selected = isFileValue(value) ? value : null;
    const kind = selected ? inferUploadKindFromFile(selected, field) : inferUploadKindFromField(field);
    const maxMb = getUploadLimitMb(field, kind);
    return (
      <div className="space-y-3">
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-7 text-center transition hover:border-amber-500 hover:bg-amber-50/50 focus-within:border-amber-600 focus-within:ring-4 focus-within:ring-amber-100">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-stone-500 shadow-sm ring-1 ring-stone-200"><FileUp className="h-5 w-5" /></span>
          <span className="mt-3 max-w-full truncate text-sm font-semibold text-stone-800">{selected ? selected.name : `Choose ${field.label.toLowerCase()}`}</span>
          <span className="mt-1 text-xs text-stone-500">{getUploadFormatLabel(kind)} · up to {maxMb}MB</span>
          {/* eslint-disable-next-line no-restricted-syntax -- public-form file dropzone, see FieldInput's comment */}
          <input type="file" accept={getUploadAccept(kind)} className="sr-only" onChange={(e) => onChange(e.target.files?.[0] || null)} required={field.required} />
        </label>
      </div>
    );
  }
  if (showAsPhone) return <PhoneNumberInput label={field.label || 'Phone'} required={field.required} value={typeof value === 'string' ? value : ''} onChange={onChange} />;
  // eslint-disable-next-line no-restricted-syntax -- public-form field, see FieldInput's comment
  if (type === 'date' && resolveDateMode(field) === 'full') return <input type="date" className={fieldInputClass} value={toHtmlDateInputValue(typeof value === 'string' ? value : '')} onChange={(e) => onChange(fromHtmlDateInputValue(e.target.value))} required={field.required} />;
  if (type === 'date') {
    const parsed = parseDDMMPartial(typeof value === 'string' ? value : '');
    const selectedMonth = parsed?.month && parsed.month !== '00' ? parsed.month : '';
    const selectedDay = parsed?.day && parsed.day !== '00' ? parsed.day : '';
    const maxDay = Number(selectedMonth) >= 1 ? daysInMonth(Number(selectedMonth)) : 31;
    const dayOptions = Array.from({ length: maxDay }, (_, index) => pad2(index + 1));
    return (
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <select className={fieldInputClass} value={selectedDay} disabled={!selectedMonth} onChange={(e) => onChange(toDDMM(e.target.value, selectedMonth))} required={field.required}><option value="">Select day</option>{dayOptions.map((day) => <option key={day} value={day}>{day}</option>)}</select>
        <select className={fieldInputClass} value={selectedMonth} onChange={(e) => { const nextMonth = e.target.value; const nextMax = daysInMonth(Number(nextMonth || '1')); const nextDay = selectedDay && Number(selectedDay) > nextMax ? pad2(nextMax) : selectedDay; onChange(toDDMM(nextDay, nextMonth)); }} required={field.required}><option value="">Select month</option>{MONTH_OPTIONS.map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}</select>
      </div>
    );
  }
  const inputType = type === 'email' ? 'email' : type === 'number' ? 'number' : 'text';
  // eslint-disable-next-line no-restricted-syntax -- public-form field, see FieldInput's comment
  return <input type={inputType} className={fieldInputClass} value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} placeholder={`Enter ${field.label.toLowerCase()}`} required={field.required} minLength={field.validation?.minLength} maxLength={field.validation?.maxLength} min={field.validation?.min} max={field.validation?.max} />;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPublicFormPayload(value: unknown): value is PublicFormPayload {
  return isRecord(value) && isRecord(value.form);
}

function unwrapPublicFormPayload(value: unknown): PublicFormPayload | null {
  if (isPublicFormPayload(value)) {
    return value;
  }

  if (isRecord(value) && 'data' in value && isPublicFormPayload(value.data)) {
    return value.data;
  }

  return null;
}

async function fetchPublicFormClient(slug: string): Promise<PublicFormPayload | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(`/api/v1/forms/${encodeURIComponent(slug)}`, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (!res.ok) return null;

    const json: unknown = await res.json();
    return unwrapPublicFormPayload(json);
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export default function PublicFormClient({ slug }: PublicFormClientProps) {
  const searchParams = useSearchParams();
  const fieldsRef = useRef<FormField[]>([]);
  const [payload, setPayload] = useState<PublicFormPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
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
  const [bannerLoadFailed, setBannerLoadFailed] = useState(false);

  const fields = useMemo<FormField[]>(() => payload?.form?.fields ?? [], [payload]);
  const sortedFields = useMemo<FormField[]>(() => fields.slice().sort((a, b) => a.order - b.order), [fields]);
  useEffect(() => { fieldsRef.current = sortedFields; }, [sortedFields]);
  const visibleFields = useMemo(() => sortedFields.filter((field) => isFieldVisible(field, values)), [sortedFields, values]);

  const settings = payload?.form?.settings;
  const requestedReturnTo = (searchParams.get('return_to') || '').trim();
  const returnTo = useMemo(() => resolveSafeReturnUrl(requestedReturnTo), [requestedReturnTo]);
  const returnDelayMs = useMemo(() => Math.max(600, Math.min(12_000, Number(searchParams.get('return_delay_ms') || 1800) || 1800)), [searchParams]);
  const hasAutoReturnTarget = Boolean(returnTo);
  const redirectToReturnUrl = useCallback(() => { if (returnTo) window.location.assign(returnTo); }, [returnTo]);

  const resetFormState = useCallback((formFields?: FormField[]) => {
    const nextFields = formFields ?? fieldsRef.current;
    setValues(buildInitialValues(nextFields));
    setFieldErrors({});
    setTouchedFields({});
    setFormError('');
  }, []);

  useEffect(() => {
    if (!successOpen || !shouldAutoReturn || !hasAutoReturnTarget) return;
    const timer = setTimeout(redirectToReturnUrl, returnDelayMs);
    return () => clearTimeout(timer);
  }, [hasAutoReturnTarget, redirectToReturnUrl, returnDelayMs, shouldAutoReturn, successOpen]);

  useEffect(() => {
    if (!slug) { setLoading(false); return; }
    let alive = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const fetchWithRetry = async (attempt: number) => {
      if (!alive) return;
      setLoading(true);
      setRetrying(attempt > 1);
      setLoadError(attempt > 1 ? 'Refreshing the latest form fields…' : null);
      const res = await fetchPublicFormClient(slug);
      if (!alive) return;
      if (res?.form) {
        setPayload(res);
        setBannerLoadFailed(false);
        resetFormState(res.form.fields ?? []);
        setSuccessOpen(false);
        setSuccessDetails([]);
        setSuccessTokens({});
        setLoading(false);
        setRetrying(false);
        setLoadError(null);
        return;
      }
      if (attempt < MAX_FETCH_ATTEMPTS) {
        timeoutId = setTimeout(() => void fetchWithRetry(attempt + 1), Math.min(RETRY_MAX_MS, RETRY_BASE_MS * attempt));
        return;
      }
      setLoadError('Unable to load this form right now. Please refresh and try again.');
      setLoading(false);
      setRetrying(false);
    };
    void fetchWithRetry(1);
    return () => { alive = false; if (timeoutId) clearTimeout(timeoutId); };
  }, [resetFormState, slug]);

  const updateValue = (key: string, next: FieldValue) => {
    setValues((prev) => ({ ...prev, [key]: next }));
    if (formError) setFormError('');
  };

  const valueToString = (value: FieldValue): string => {
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'boolean') return value ? 'Yes' : '';
    if (Array.isArray(value)) return value.join(', ');
    if (isFileValue(value)) return value.name;
    return '';
  };
  const findValueByKeywords = (keywords: string[], sourceValues: ValuesState) => {
    const match = fields.find((field) => keywords.some((keyword) => `${field.key} ${field.label}`.toLowerCase().includes(keyword)) && valueToString(sourceValues[field.key]));
    return match ? valueToString(sourceValues[match.key]) : '';
  };
  const buildSuccessTokens = (sourceValues: ValuesState) => {
    const formTitle = payload?.form?.title ?? '';
    const eventTitle = payload?.event?.title ?? formTitle;
    const eventDate = formatDate(payload?.event?.date, settings?.dateFormat);
    const eventTime = payload?.event?.time ?? '';
    const eventLocation = payload?.event?.location ?? '';
    const name = findValueByKeywords(['full name', 'name'], sourceValues);
    const email = findValueByKeywords(['email'], sourceValues);
    const phoneRaw = findValueByKeywords(['phone', 'mobile', 'tel', 'contact', 'contactnumber'], sourceValues);
    const phone = phoneRaw ? formatPrettyPhone(phoneRaw) : '';
    return { formTitle, eventTitle, eventDate, eventTime, eventLocation, name, email, phone };
  };

  const validateUploadFile = (field: FormField, file: File): string | null => {
    const kind = inferUploadKindFromFile(file, field);
    const acceptedTypes = ACCEPTED_UPLOAD_TYPES[kind];
    const acceptedExts = ACCEPTED_UPLOAD_EXTENSIONS[kind];
    const maxMb = getUploadLimitMb(field, kind);
    if (file.size === 0) return 'This file is empty. Please choose a valid file.';
    if (acceptedTypes.length > 0 && !acceptedTypes.includes(file.type)) {
      const lowerName = file.name.toLowerCase();
      if (!acceptedExts.some((ext) => lowerName.endsWith(ext))) return `Unsupported file type. Accepted formats: ${getUploadFormatLabel(kind)}.`;
    }
    if (file.size > maxMb * MB) return `File must be ${maxMb}MB or smaller.`;
    return null;
  };

  const validateFieldValue = (field: FormField, next: FieldValue): string | null => {
    const type = normalizeFieldType(field.type);
    const label = field.label || 'This field';
    const hasOptions = Array.isArray(field.options) && field.options.length > 0;
    const isPhoneField = isPhoneType(type) || isPhoneLikeField(field);
    if (isUploadType(type)) return isFileValue(next) ? validateUploadFile(field, next) : field.required ? `${label} is required.` : null;
    if (isCheckboxType(type) && hasOptions) {
      if (field.required && (!Array.isArray(next) || next.length === 0)) return `${label} is required.`;
      if (Array.isArray(next) && next.some((value) => !field.options?.some((option) => option.value === value))) return `Please select valid ${label.toLowerCase()} options.`;
      return null;
    }
    if (isCheckboxType(type)) return field.required && next !== true ? `${label} is required.` : null;
    const raw = typeof next === 'string' ? next.trim() : '';
    if (!raw) return field.required ? `${label} is required.` : null;
    if ((isSelectType(type) || isRadioType(type)) && hasOptions && !field.options?.some((option) => option.value === raw)) return `Please select a valid ${label.toLowerCase()} option.`;
    if (field.validation?.minLength !== undefined && raw.length < field.validation.minLength) return `${label} must be at least ${field.validation.minLength} characters.`;
    if (field.validation?.maxLength !== undefined && raw.length > field.validation.maxLength) return `${label} cannot exceed ${field.validation.maxLength} characters.`;
    if (field.validation?.maxWords !== undefined && countWords(raw) > field.validation.maxWords) return `${label} cannot exceed ${field.validation.maxWords} words.`;
    if (field.validation?.pattern) {
      try {
        if (!new RegExp(field.validation.pattern).test(raw)) return `${label} is not in the expected format.`;
      } catch {
        // Invalid admin-authored patterns are ignored client-side; the API remains authoritative.
      }
    }
    if (type === 'email' && !emailRe.test(raw)) return 'Please enter a valid email address.';
    if (isPrayerRequestField(field) && countWords(raw) > PRAYER_REQUEST_WORD_LIMIT) return `Prayer request cannot exceed ${PRAYER_REQUEST_WORD_LIMIT} words.`;
    if (isPhoneField && !e164Re.test(raw)) return 'Please enter a valid phone number including country code, e.g. +2348012345678.';
    if (type === 'number') {
      const numberValue = Number(raw);
      if (Number.isNaN(numberValue)) return 'Please enter a valid number.';
      if (field.validation?.min !== undefined && numberValue < field.validation.min) return `${label} must be ${field.validation.min} or more.`;
      if (field.validation?.max !== undefined && numberValue > field.validation.max) return `${label} must be ${field.validation.max} or less.`;
    }
    if (type === 'date') return resolveDateMode(field) === 'full' ? normalizeFullDate(raw) ? null : 'Please enter a valid date.' : parseDDMM(raw) ? null : 'Please enter a valid date in DD-MM format.';
    return null;
  };

  const updateFieldValue = (field: FormField, next: FieldValue) => {
    setTouchedFields((prev) => (prev[field.key] ? prev : { ...prev, [field.key]: true }));
    const error = validateFieldValue(field, next);
    setFieldErrors((prev) => {
      const updated = { ...prev };
      if (error) updated[field.key] = error;
      else delete updated[field.key];
      return updated;
    });
    if (!(error && isFileValue(next))) updateValue(field.key, next);
  };

  const formTitle = payload?.form?.title?.trim() || 'Form';
  const formTypeLabel = (settings?.formType || 'FORM').trim().toUpperCase();
  const eventTitle = payload?.event?.title ?? formTitle;
  const bannerUrl = settings?.design?.coverImageUrl || payload?.event?.bannerImage || payload?.event?.image || undefined;
  const displayBannerUrl = bannerLoadFailed ? undefined : bannerUrl;
  const contentSections = useMemo<ContentSectionView[]>(() => {
    const configured = Array.isArray(settings?.contentSections) ? settings.contentSections.map((section) => ({ title: section?.title?.trim() || '', subtitle: section?.subtitle?.trim() || '', items: Array.isArray(section?.items) ? section.items.map((item) => item.trim()).filter(Boolean) : [], itemSubtexts: Array.isArray(section?.itemSubtexts) ? section.itemSubtexts.map((item) => item.trim()) : [] })).filter((section) => section.title || section.subtitle || section.items.length > 0) : [];
    if (configured.length > 0) return configured;
    const bullets = Array.isArray(settings?.introBullets) ? settings.introBullets.map((item) => item.trim()).filter(Boolean) : [];
    const subtexts = Array.isArray(settings?.introBulletSubtexts) ? settings.introBulletSubtexts.map((item) => item.trim()) : [];
    const fallback = { title: settings?.introTitle?.trim() || 'Form Details', subtitle: settings?.introSubtitle?.trim() || payload?.form?.description?.trim() || payload?.event?.shortDescription?.trim() || '', items: bullets, itemSubtexts: subtexts };
    return fallback.title || fallback.subtitle || fallback.items.length ? [fallback] : [];
  }, [payload, settings]);
  const layoutMode = settings?.layoutMode === 'stack' ? 'stack' : 'split';
  const showDetailsColumn = contentSections.length > 0;
  const submitButtonLabel = settings?.submitButtonText?.trim() || settings?.design?.ctaButtonLabel?.trim() || 'Submit Registration';
  const privacyCopy = settings?.design?.privacyCopy ?? 'By submitting, you confirm your details are accurate.';
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME?.trim() || 'The Wisdom Church';
  const siteSubtitle = process.env.NEXT_PUBLIC_SITE_SUBTITLE?.trim() || 'Online Registration';
  const siteHomeUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.NEXT_PUBLIC_PUBLIC_URL?.trim() || (typeof window !== 'undefined' && window.location.origin ? window.location.origin : '/');
  const siteLogoSrc = process.env.NEXT_PUBLIC_SITE_LOGO_PATH?.trim() || '/OIP.webp';

  const submitButtonIcon = useMemo(() => {
    switch (settings?.submitButtonIcon) {
      case 'check': return <Check className="h-4 w-4" />;
      case 'send': return <Send className="h-4 w-4" />;
      case 'calendar': return <Calendar className="h-4 w-4" />;
      case 'cursor': return <MousePointer2 className="h-4 w-4" />;
      default: return <ChevronRight className="h-4 w-4" />;
    }
  }, [settings?.submitButtonIcon]);

  const closesAt = settings?.closesAt ? new Date(settings.closesAt) : null;
  const expiresAt = settings?.expiresAt ? new Date(settings.expiresAt) : null;
  const now = new Date();
  const isClosed = Boolean((closesAt && !Number.isNaN(closesAt.getTime()) && now > closesAt) || (expiresAt && !Number.isNaN(expiresAt.getTime()) && now > expiresAt));

  const validateClient = () => {
    const nextErrors: Record<string, string> = {};
    let anyFilled = false;
    visibleFields.forEach((field) => {
      const value = values[field.key];
      if (isFileValue(value) || (Array.isArray(value) && value.length > 0) || value === true || (typeof value === 'string' && value.trim())) anyFilled = true;
      const error = validateFieldValue(field, value);
      if (error) nextErrors[field.key] = error;
    });
    setTouchedFields((prev) => ({ ...prev, ...Object.fromEntries(visibleFields.map((field) => [field.key, true])) }));
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) { const message = 'Please review the highlighted fields and try again.'; setFormError(message); return { isValid: false, message }; }
    if (!anyFilled) { const message = 'Please provide at least one response before submitting.'; setFormError(message); return { isValid: false, message }; }
    setFormError('');
    return { isValid: true, message: null };
  };

  const submit = async () => {
    if (!slug || !payload) return;
    try {
      if (isClosed) { toast.error('This registration is closed.'); return; }
      const validation = validateClient();
      if (!validation.isValid) { toast.error(validation.message || 'Please review the form and try again.'); return; }
      setSubmitting(true);
      const rawValuesPayload: PublicSubmissionValues = {};
      visibleFields.forEach((field) => {
        const value = values[field.key];
        if (value === undefined || value === null) return;
        if (isFileValue(value) || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number' || Array.isArray(value)) rawValuesPayload[field.key] = value;
      });
      const uploadedValuesPayload = await prepareUploadPayload({ fields: visibleFields, values: rawValuesPayload, module: 'public-forms', ownerType: 'public-form', ownerId: payload.form.id, slug, folderPrefix: 'public-forms', addImageAliases: shouldNormalizeLeadershipValues(slug) });
      const normalizedValuesPayload = await prepareLeadershipPublicSubmissionValues(slug, uploadedValuesPayload);
      await apiClient.submitPublicForm(slug, { values: normalizedValuesPayload });
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
        setTouchedFields((prev) => ({ ...prev, ...Object.fromEntries(Object.keys(serverFieldErrors).map((key) => [key, true])) }));
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

  if (!slug) return <StateScreen title="Invalid form link" description="Please check the URL and try again." />;
  if (loading) return <StateScreen loading title={retrying ? 'Reconnecting…' : 'Loading form…'} description={loadError || (retrying ? 'Refreshing the latest form fields.' : 'Preparing the secure form.')} />;
  if (!payload) return <StateScreen title="Unable to load form" description={loadError || 'Unable to load this form right now.'} action={<Button variant="outline" onClick={() => window.location.reload()}>Retry</Button>} />;

  const tokenSource = Object.keys(successTokens).length > 0 ? successTokens : buildSuccessTokens(values);
  const successTitle = applyTemplate(settings?.successTitle || 'Thank you for registering', tokenSource);
  const successSubtitle = applyTemplate(settings?.successSubtitle || 'for {{formTitle}}', tokenSource);
  const successDescription = applyTemplate(settings?.successMessage || 'We would love to see you.', tokenSource);

  return (
    <div className="public-form-light min-h-screen bg-[#faf9f6] text-stone-950">
      <header className="border-b border-stone-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
          <Link href={siteHomeUrl} className="flex min-w-0 items-center gap-3" prefetch={false}>
            <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-stone-200 bg-white sm:h-11 sm:w-11"><Image src={siteLogoSrc} alt={`${siteName} logo`} fill className="object-cover" sizes="44px" /></span>
            <span className="min-w-0 leading-tight"><span className="block truncate text-sm font-bold text-stone-950 sm:text-base">{siteName}</span><span className="hidden truncate text-xs text-stone-500 sm:block">{siteSubtitle}</span></span>
          </Link>
          <div className="flex items-center gap-1.5 text-xs text-stone-600 sm:gap-3">
            <Link href={siteHomeUrl} className="hidden rounded-lg px-3 py-2 font-medium transition hover:bg-stone-100 hover:text-stone-950 sm:inline-flex" prefetch={false}>Home</Link>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 font-semibold text-emerald-800 sm:px-3"><ShieldCheck className="h-3.5 w-3.5" /> Secure form</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8 lg:py-14">
        <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-[0_18px_50px_-36px_rgba(28,25,23,0.45)] sm:rounded-3xl">
          <div className={displayBannerUrl ? 'grid lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.78fr)]' : ''}>
            <div className="flex flex-col justify-center p-5 sm:p-8 lg:p-10 xl:p-12">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between lg:flex-col">
                <div className="max-w-2xl">
                <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-[11px] font-bold tracking-[0.16em] text-amber-800 ring-1 ring-inset ring-amber-200">{formTypeLabel}</span>
                <h1 className="mt-4 break-words text-3xl font-bold tracking-[-0.035em] text-stone-950 sm:text-4xl xl:text-5xl">{formTitle}</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600 sm:text-base sm:leading-7">{payload.form.description?.trim() || payload.event?.shortDescription?.trim() || 'Complete the form with accurate details so your registration can be processed correctly.'}</p>
                </div>
                <span className={`inline-flex w-fit shrink-0 items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold ${isClosed ? 'bg-red-50 text-red-700 ring-1 ring-red-200' : 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'}`}><span className={`h-2 w-2 rounded-full ${isClosed ? 'bg-red-500' : 'bg-emerald-500'}`} />{isClosed ? 'Submissions closed' : 'Accepting responses'}</span>
              </div>
              {isClosed ? <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Registration is closed for this form.</div> : null}
            </div>
            {displayBannerUrl ? (
              <div className="relative min-h-56 overflow-hidden border-t border-stone-200 bg-stone-100 sm:min-h-72 lg:min-h-full lg:border-l lg:border-t-0">
                <Image src={displayBannerUrl} alt="" fill className="scale-110 object-cover opacity-20 blur-xl" sizes="(max-width: 1024px) 100vw, 440px" aria-hidden unoptimized />
                <div className="absolute inset-3 overflow-hidden rounded-xl bg-white/75 shadow-lg ring-1 ring-black/5 sm:inset-5 sm:rounded-2xl lg:inset-6">
                  <Image src={displayBannerUrl} alt={`${eventTitle} header artwork`} fill className="object-contain" sizes="(max-width: 1024px) calc(100vw - 48px), 400px" priority unoptimized onError={() => setBannerLoadFailed(true)} />
                </div>
              </div>
            ) : <div className="h-2 bg-gradient-to-r from-amber-600 via-yellow-400 to-amber-600 lg:hidden" />}
          </div>
        </section>

        <div className={showDetailsColumn && layoutMode === 'split' ? 'mt-6 grid items-start gap-6 lg:mt-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8' : 'mx-auto mt-6 max-w-3xl space-y-6 lg:mt-8'}>
          <div className={showDetailsColumn && layoutMode === 'split' ? 'min-w-0' : ''}>
            <Card className="rounded-2xl border-stone-200 bg-white p-5 shadow-[0_18px_50px_-40px_rgba(28,25,23,0.45)] sm:rounded-3xl sm:p-8" contentClassName="p-0">
              <div className="mb-7 border-b border-stone-200 pb-5">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">Your information</p>
                <h2 className="mt-2 text-xl font-bold text-stone-950 sm:text-2xl">Please complete the form below</h2>
                <p className="mt-2 text-sm leading-6 text-stone-500"><span className="font-semibold text-red-600">*</span> indicates a required field.</p>
              </div>
              {settings?.formHeaderNote ? <p className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">{settings.formHeaderNote}</p> : null}
              <div className="space-y-6">
                {visibleFields.map((field) => {
                  const type = normalizeFieldType(field.type);
                  const showLabel = !isCheckboxType(type) || (Array.isArray(field.options) && field.options.length > 0);
                  return (
                    <div key={field.key}>
                      {showLabel ? <label className="mb-2 block text-sm font-semibold text-stone-800">{field.label} {field.required ? <span className="text-red-600" aria-label="required">*</span> : <span className="font-normal text-stone-400">(optional)</span>}</label> : null}
                      <FieldInput field={field} value={values[field.key]} onChange={(next) => updateFieldValue(field, next)} />
                      {fieldErrors[field.key] && touchedFields[field.key] ? <p className="mt-2 text-xs font-semibold text-red-600" role="alert">{fieldErrors[field.key]}</p> : null}
                    </div>
                  );
                })}
              </div>
              <div className="mt-8 border-t border-stone-200 pt-6">
                {formError ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{formError}</div> : null}
                <Button className="min-h-12 w-full rounded-xl bg-amber-600 text-sm font-bold text-white shadow-sm hover:bg-amber-700 focus-visible:ring-amber-600 sm:w-auto sm:min-w-52" loading={submitting} disabled={submitting || isClosed} onClick={submit} icon={submitting ? undefined : submitButtonIcon}>{submitting ? 'Submitting securely...' : submitButtonLabel}</Button>
                <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-stone-500"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{privacyCopy}</p>
              </div>
            </Card>
          </div>

          {showDetailsColumn ? (
            <aside className="order-first space-y-4 lg:order-none lg:sticky lg:top-6 lg:self-start">
              {contentSections.map((section, index) => (
                <Card key={`${section.title || 'section'}-${index}`} className="rounded-2xl border-stone-200 bg-white p-5 shadow-sm sm:p-6" contentClassName="p-0">
                  {section.title ? <h2 className="break-words text-base font-bold text-stone-950">{section.title}</h2> : null}
                  {section.subtitle ? <p className="mt-2 break-words text-sm leading-6 text-stone-600">{section.subtitle}</p> : null}
                  {section.items.length > 0 ? <ul className="mt-5 space-y-4">{section.items.map((item, idx) => <li key={`${item}-${idx}`} className="flex items-start gap-3"><span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-800"><Check className="h-3.5 w-3.5" /></span><span className="min-w-0"><span className="block break-words text-sm font-semibold text-stone-800">{item}</span>{section.itemSubtexts[idx] ? <span className="mt-1 block break-words text-xs leading-5 text-stone-500">{section.itemSubtexts[idx]}</span> : null}</span></li>)}</ul> : null}
                </Card>
              ))}
            </aside>
          ) : null}
        </div>
      </main>

      <footer className="mx-auto max-w-6xl border-t border-stone-200 px-4 py-8 text-xs text-stone-500 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><span>{siteName}</span><span>© {new Date().getFullYear()} {siteName}. All rights reserved.</span></div>
      </footer>

      <SuccessModal
        open={successOpen}
        title={successTitle}
        subtitle={successSubtitle}
        description={successDescription}
        details={successDetails}
        onClose={() => { if (hasAutoReturnTarget) { redirectToReturnUrl(); return; } setShouldAutoReturn(false); setSuccessOpen(false); }}
        primaryAction={{ label: hasAutoReturnTarget ? 'Return to website' : 'Done', onClick: () => { if (hasAutoReturnTarget) { redirectToReturnUrl(); return; } setShouldAutoReturn(false); setSuccessOpen(false); } }}
        secondaryAction={{ label: 'Submit another response', onClick: () => { setShouldAutoReturn(false); setSuccessOpen(false); resetFormState(); }, variant: 'outline' }}
      />
    </div>
  );
}

function StateScreen({ title, description, action, loading }: { title: string; description: string; action?: React.ReactNode; loading?: boolean }) {
  return (
    <div className="public-form-light flex min-h-screen items-center justify-center bg-[#faf9f6] p-6 text-center">
      <div className="w-full max-w-md rounded-[2rem] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-8 shadow-sm">
        {loading ? <Loader2 className="mx-auto h-10 w-10 animate-spin text-[var(--color-accent-primary)]" /> : <ShieldCheck className="mx-auto h-10 w-10 text-[var(--color-text-tertiary)]" />}
        <h1 className="mt-4 text-xl font-black text-[var(--color-text-primary)]">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{description}</p>
        {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
      </div>
    </div>
  );
}
