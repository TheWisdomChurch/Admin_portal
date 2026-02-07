import { z } from 'zod';
import type { FormFieldType } from '@/lib/types';
import { normalizeFieldKey } from './helpers';

const formFieldTypes: readonly FormFieldType[] = [
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
] as const;

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const optionSchema = z.object({
  label: z.string().trim().min(1, 'Option label is required'),
  value: z.string().trim().min(1, 'Option value is required'),
});

export const fieldDraftSchema = z.object({
  key: z.string().trim().min(1, 'Field key is required'),
  label: z.string().trim().min(1, 'Field label is required'),
  type: z.enum(formFieldTypes),
  required: z.boolean(),
  order: z.number().int().positive(),
  options: z.array(optionSchema).optional(),
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
      const needsOptions = field.type === 'select' || field.type === 'radio' || field.type === 'checkbox';
      if (needsOptions) {
        const opts = field.options ?? [];
        if (opts.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['fields', index, 'options'],
            message: 'Provide at least one option',
          });
        }
      }
    });
  });

export type CreateFormSchema = z.infer<typeof createFormSchema>;
