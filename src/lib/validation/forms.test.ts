import { describe, expect, it } from 'vitest';

import { createFormSchema } from './forms';

const baseField = { key: 'name', label: 'Name', type: 'text' as const, required: true, order: 1 };
const form = (fields: unknown[]) => ({ title: 'Test form', slug: 'test-form', fields });

describe('createFormSchema field edge cases', () => {
  it('accepts a zero minimum length', () => {
    expect(createFormSchema.safeParse(form([{ ...baseField, validation: { minLength: 0 } }])).success).toBe(true);
  });

  it('rejects contradictory text and number limits', () => {
    expect(createFormSchema.safeParse(form([{ ...baseField, validation: { minLength: 10, maxLength: 2 } }])).success).toBe(false);
    expect(createFormSchema.safeParse(form([{ ...baseField, type: 'number', validation: { min: 10, max: 2 } }])).success).toBe(false);
  });

  it('rejects invalid regular expressions and duplicate option values', () => {
    expect(createFormSchema.safeParse(form([{ ...baseField, validation: { pattern: '[' } }])).success).toBe(false);
    expect(createFormSchema.safeParse(form([{ ...baseField, type: 'select', options: [{ label: 'One', value: 'same' }, { label: 'Two', value: 'SAME' }] }])).success).toBe(false);
  });

  it('rejects blank conditional comparisons', () => {
    const result = createFormSchema.safeParse(form([
      baseField,
      { key: 'detail', label: 'Detail', type: 'text', required: false, order: 2, visibility: { match: 'all', rules: [{ fieldKey: 'name', operator: 'equals', value: '  ' }] } },
    ]));
    expect(result.success).toBe(false);
  });

  it('rejects circular conditional visibility', () => {
    const result = createFormSchema.safeParse(form([
      { ...baseField, visibility: { match: 'all', rules: [{ fieldKey: 'detail', operator: 'equals', value: 'yes' }] } },
      { key: 'detail', label: 'Detail', type: 'text', required: false, order: 2, visibility: { match: 'all', rules: [{ fieldKey: 'name', operator: 'equals', value: 'yes' }] } },
    ]));
    expect(result.success).toBe(false);
  });
});
