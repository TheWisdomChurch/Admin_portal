import { z } from 'zod';
import type { FormFieldType } from '@/lib/types';
import { ALL_FIELD_TYPES, isOptionFieldType } from '@/lib/formFields';
import { normalizeFieldKey } from './helpers';

const formFieldTypes: readonly FormFieldType[] = ALL_FIELD_TYPES;

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const optionSchema = z.object({
  label: z.string().trim().min(1, 'Option label is required'),
  value: z.string().trim().min(1, 'Option value is required'),
});

const visibilityRuleSchema = z.object({
  fieldKey: z.string().trim().min(1, 'Visibility field is required'),
  operator: z.enum(['equals', 'not_equals', 'in', 'not_in']),
  value: z.union([z.string(), z.boolean(), z.number()]).optional(),
  values: z.array(z.union([z.string(), z.boolean(), z.number()])).optional(),
});

const visibilitySchema = z.object({
  match: z.enum(['all', 'any']).optional(),
  rules: z.array(visibilityRuleSchema).min(1, 'Add at least one visibility rule'),
});

const fieldValidationSchema = z
  .object({
    minLength: z.number().int().nonnegative().optional(),
    maxLength: z.number().int().positive().optional(),
    maxWords: z.number().int().positive().optional(),
    pattern: z.string().trim().min(1).optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    dateMode: z.enum(['full', 'day-month']).optional(),
  })
  .optional();

export const fieldDraftSchema = z.object({
  key: z.string().trim().min(1, 'Field key is required'),
  label: z.string().trim().min(1, 'Field label is required'),
  type: z.enum(formFieldTypes),
  required: z.boolean(),
  order: z.number().int().positive(),
  options: z.array(optionSchema).optional(),
  validation: fieldValidationSchema,
  visibility: visibilitySchema.optional(),
});

export const createFormSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required'),
    description: z.string().trim().optional(),
    slug: z
      .string()
      .trim()
      .min(1, 'Slug is required')
      .regex(slugRegex, 'Slug must be lowercase letters, numbers, and hyphens'),
    eventId: z.string().trim().optional(),
    fields: z.array(fieldDraftSchema).min(1, 'Add at least one field'),
  })
  .superRefine((data, ctx) => {
    const keys = data.fields.map((f) => normalizeFieldKey(f.key));
    const duplicates = keys.filter((k, i) => keys.indexOf(k) !== i);
    if (duplicates.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['fields'],
        message: `Field keys must be unique. Duplicate: ${duplicates[0]}`,
      });
    }

    data.fields.forEach((field, index) => {
      if (field.validation?.minLength !== undefined && field.validation?.maxLength !== undefined && field.validation.minLength > field.validation.maxLength) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['fields', index, 'validation', 'maxLength'], message: 'Maximum length must be greater than or equal to minimum length' });
      }
      if (field.validation?.min !== undefined && field.validation?.max !== undefined && field.validation.min > field.validation.max) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['fields', index, 'validation', 'max'], message: 'Maximum value must be greater than or equal to minimum value' });
      }
      if (field.validation?.pattern) {
        try {
          new RegExp(field.validation.pattern);
        } catch {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['fields', index, 'validation', 'pattern'], message: 'Pattern must be a valid regular expression' });
        }
      }
      if (isOptionFieldType(field.type)) {
        const opts = field.options ?? [];
        if (opts.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['fields', index, 'options'],
            message: 'Provide at least one option',
          });
        }
        const optionValues = opts.map((option) => option.value.trim().toLowerCase());
        if (new Set(optionValues).size !== optionValues.length) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['fields', index, 'options'], message: 'Option values must be unique' });
        }
      }

      const rules = field.visibility?.rules ?? [];
      rules.forEach((rule, ruleIndex) => {
        const refKey = normalizeFieldKey(rule.fieldKey);
        const selfKey = normalizeFieldKey(field.key);
        if (!keys.includes(refKey)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['fields', index, 'visibility', 'rules', ruleIndex, 'fieldKey'],
            message: 'Select a valid controlling field',
          });
        }
        if (refKey === selfKey) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['fields', index, 'visibility', 'rules', ruleIndex, 'fieldKey'],
            message: 'A field cannot depend on itself',
          });
        }
        if ((rule.operator === 'equals' || rule.operator === 'not_equals') && (rule.value === undefined || (typeof rule.value === 'string' && !rule.value.trim()))) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['fields', index, 'visibility', 'rules', ruleIndex, 'value'],
            message: 'Set a comparison value',
          });
        }
        if ((rule.operator === 'in' || rule.operator === 'not_in') && (!rule.values || rule.values.length === 0 || rule.values.some((value) => typeof value === 'string' && !value.trim()))) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['fields', index, 'visibility', 'rules', ruleIndex, 'values'],
            message: 'Provide at least one comparison value',
          });
        }
      });
    });

    const dependencies = new Map<string, string[]>();
    data.fields.forEach((field) => {
      dependencies.set(normalizeFieldKey(field.key), (field.visibility?.rules || []).map((rule) => normalizeFieldKey(rule.fieldKey)).filter(Boolean));
    });
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const hasCycle = (key: string): boolean => {
      if (visiting.has(key)) return true;
      if (visited.has(key)) return false;
      visiting.add(key);
      const cyclic = (dependencies.get(key) || []).some((dependency) => dependencies.has(dependency) && hasCycle(dependency));
      visiting.delete(key);
      visited.add(key);
      return cyclic;
    };
    if ([...dependencies.keys()].some(hasCycle)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['fields'], message: 'Conditional visibility rules cannot form a circular dependency' });
    }
  });

export type CreateFormSchema = z.infer<typeof createFormSchema>;
