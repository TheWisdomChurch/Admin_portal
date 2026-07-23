import type { FormFieldCondition, FormFieldOption, FormFieldType, FormFieldVisibility } from '@/lib/types';

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

/** Guarantees select/radio/checkbox fields carry at least a sane default pair of options. */
export function ensureFieldOptions<T extends { type: FormFieldType; options?: FormFieldOption[] }>(field: T): T {
  if (!isOptionFieldType(field.type)) {
    return { ...field, options: undefined };
  }

  const options = Array.isArray(field.options) ? field.options : [];
  if (options.length > 0) return { ...field, options };

  return {
    ...field,
    options: [
      { label: 'Option 1', value: 'option-1' },
      { label: 'Option 2', value: 'option-2' },
    ],
  };
}

/** Cleans a field's options for submission: drops blank labels, re-slugifies values. */
export function normalizeFieldOptions<T extends { type: FormFieldType; options?: FormFieldOption[] }>(
  field: T
): FormFieldOption[] | undefined {
  if (!isOptionFieldType(field.type)) return undefined;

  const normalized = (field.options || [])
    .map((option, index) => {
      const label = (option.label || '').trim();
      if (!label) return null;
      return { label, value: slugifyOptionValue(option.value || label, `option-${index + 1}`) };
    })
    .filter((option): option is FormFieldOption => option !== null);

  return normalized.length > 0 ? normalized : undefined;
}

// --- Conditional visibility -------------------------------------------------
// Shared by the create/edit builders (interactive rule editing, via
// FieldEditor) and the save-time payload sanitization in each page.

export const VISIBILITY_OPERATORS: Array<{ value: FormFieldCondition['operator']; label: string }> = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Does not equal' },
  { value: 'in', label: 'Matches any' },
  { value: 'not_in', label: 'Matches none' },
];

export function usesVisibilityList(operator: FormFieldCondition['operator']): boolean {
  return operator === 'in' || operator === 'not_in';
}

function sanitizeVisibilityValue(value: unknown): string | number | boolean | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'boolean') return value;
  return undefined;
}

/** Validates and cleans a field's visibility rules before submission; drops malformed rules entirely. */
export function sanitizeFieldVisibility(visibility?: FormFieldVisibility): FormFieldVisibility | undefined {
  if (!visibility || !Array.isArray(visibility.rules) || visibility.rules.length === 0) {
    return undefined;
  }

  const rules = visibility.rules.reduce<FormFieldCondition[]>((acc, rule) => {
    const fieldKey = typeof rule.fieldKey === 'string' ? rule.fieldKey.trim() : '';
    if (!fieldKey) return acc;

    const operator: FormFieldCondition['operator'] = VISIBILITY_OPERATORS.some((item) => item.value === rule.operator)
      ? rule.operator
      : 'equals';

    if (usesVisibilityList(operator)) {
      const values = Array.isArray(rule.values)
        ? rule.values.map((value) => sanitizeVisibilityValue(value)).filter((value): value is string | number | boolean => typeof value !== 'undefined')
        : [];
      if (values.length === 0) return acc;
      acc.push({ fieldKey, operator, values });
      return acc;
    }

    const value = sanitizeVisibilityValue(rule.value);
    if (typeof value === 'undefined') return acc;

    acc.push({ fieldKey, operator, value });
    return acc;
  }, []);

  if (rules.length === 0) return undefined;

  return {
    match: visibility.match === 'any' ? 'any' : 'all',
    rules,
  };
}
