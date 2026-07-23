import type { FormFieldType } from '@/lib/types';

// Canonical field-type classification, shared by the create/edit form
// builders and the request-validation schema. Previously hand-copied three
// times (validation/forms.ts, forms/new/page.tsx, forms/[id]/edit/page.tsx)
// with no shared source, so a new field type added to one could silently
// diverge from the others.

export const ALL_FIELD_TYPES: readonly FormFieldType[] = [
  'text',
  'email',
  'tel',
  'number',
  'date',
  'textarea',
  'select',
  'radio',
  'checkbox',
  'image',
  'file',
  'upload',
  'video',
  'audio',
  'document',
] as const;

export const FIELD_TYPE_LABELS: Record<FormFieldType, string> = {
  text: 'Text',
  email: 'Email',
  tel: 'Phone',
  number: 'Number',
  date: 'Date',
  textarea: 'Textarea',
  select: 'Dropdown',
  radio: 'Radio',
  checkbox: 'Checkbox',
  image: 'Image upload',
  file: 'File upload',
  upload: 'Generic upload',
  video: 'Video upload',
  audio: 'Audio upload',
  document: 'Document upload',
};

const OPTION_FIELD_TYPES = new Set<FormFieldType>(['select', 'radio', 'checkbox']);
const UPLOAD_FIELD_TYPES = new Set<FormFieldType>(['image', 'file', 'upload', 'video', 'audio', 'document']);

/** Whether this field type needs a configurable list of `options` (select/radio/checkbox). */
export function isOptionFieldType(type: FormFieldType): boolean {
  return OPTION_FIELD_TYPES.has(type);
}

/** Whether this field type collects an uploaded asset rather than a typed value. */
export function isUploadFieldType(type: FormFieldType): boolean {
  return UPLOAD_FIELD_TYPES.has(type);
}

/** Derives a URL/JSON-safe option value from its display label (e.g. "Yes, please" -> "yes-please"). */
export function slugifyOptionValue(label: string, fallback: string): string {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || fallback;
}
