'use client';

// Canonical per-field editing UI shared by the create (forms/new) and edit
// (forms/[id]/edit) form builders. Previously each builder hand-rolled its
// own version of this block and drifted: create only exposed a `maxWords`
// validation knob and had no conditional-visibility UI at all, while edit
// had visibility but no validation config beyond maxWords either. Sharing
// this component means a field type or validation/visibility capability
// added here is available identically in both builders — the divergence
// cannot silently reopen.

import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { Select } from '@/ui/Select';
import { Checkbox } from '@/ui/Checkbox';

import {
  ALL_FIELD_TYPES,
  FIELD_TYPE_LABELS,
  VISIBILITY_OPERATORS,
  isOptionFieldType,
  slugifyOptionValue,
  usesVisibilityList,
} from '@/lib/formFields';
import type { FormField, FormFieldCondition, FormFieldOption, FormFieldType } from '@/lib/types';

export type FieldDraft = Omit<FormField, 'id'>;

function defaultOptions(): FormFieldOption[] {
  return [
    { label: 'Option 1', value: 'option-1' },
    { label: 'Option 2', value: 'option-2' },
  ];
}

function createEmptyVisibilityRule(): FormFieldCondition {
  return { fieldKey: '', operator: 'equals', value: '' };
}

interface FieldEditorProps {
  field: FieldDraft;
  index: number;
  /** Every field in the form (including this one) — populates the visibility "when field" picker. */
  allFields: FieldDraft[];
  onChange: (updates: Partial<FieldDraft>) => void;
  onRemove: () => void;
}

export function FieldEditor({ field, index, allFields, onChange, onRemove }: FieldEditorProps) {
  const options = Array.isArray(field.options) ? field.options : [];
  const visibilityRules = Array.isArray(field.visibility?.rules) ? field.visibility.rules : [];
  const visibilityEnabled = visibilityRules.length > 0;
  const visibilityMatch = field.visibility?.match === 'any' ? 'any' : 'all';
  const targetFields = allFields.filter((candidate, candidateIndex) => candidateIndex !== index && Boolean(candidate.key?.trim()));

  function handleTypeChange(nextType: FormFieldType) {
    const nextOptions = isOptionFieldType(nextType) ? (options.length > 0 ? options : defaultOptions()) : undefined;
    onChange({ type: nextType, options: nextOptions });
  }

  function addOption() {
    const nextNumber = options.length + 1;
    onChange({ options: [...options, { label: `Option ${nextNumber}`, value: `option-${nextNumber}` }] });
  }

  function updateOptionLabel(optionIndex: number, label: string) {
    const next = [...options];
    if (!next[optionIndex]) return;
    next[optionIndex] = { label, value: slugifyOptionValue(label, `option-${optionIndex + 1}`) };
    onChange({ options: next });
  }

  function removeOption(optionIndex: number) {
    if (options.length <= 1) {
      toast.error('An option field must keep at least one option.');
      return;
    }
    onChange({ options: options.filter((_, i) => i !== optionIndex) });
  }

  function setVisibilityEnabled(enabled: boolean) {
    onChange({ visibility: enabled ? { match: 'all', rules: [createEmptyVisibilityRule()] } : undefined });
  }

  function updateVisibilityMatch(match: 'all' | 'any') {
    onChange({ visibility: { match, rules: visibilityRules } });
  }

  function updateVisibilityRule(ruleIndex: number, updates: Partial<FormFieldCondition>) {
    const nextRules = [...visibilityRules];
    if (!nextRules[ruleIndex]) return;
    nextRules[ruleIndex] = { ...nextRules[ruleIndex], ...updates };
    onChange({ visibility: { match: visibilityMatch, rules: nextRules } });
  }

  function addVisibilityRule() {
    onChange({ visibility: { match: visibilityMatch, rules: [...visibilityRules, createEmptyVisibilityRule()] } });
  }

  function removeVisibilityRule(ruleIndex: number) {
    const nextRules = visibilityRules.filter((_, i) => i !== ruleIndex);
    onChange({ visibility: nextRules.length > 0 ? { match: visibilityMatch, rules: nextRules } : undefined });
  }

  function getTargetOptions(fieldKey: string): FormFieldOption[] {
    const target = allFields.find((candidate) => candidate.key === fieldKey);
    return Array.isArray(target?.options) ? target.options : [];
  }

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Input label="Label" value={field.label} onChange={(event) => onChange({ label: event.target.value })} />
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Select
            label="Type"
            value={field.type}
            onChange={(event) => handleTypeChange(event.target.value as FormFieldType)}
            className="min-w-[10rem]"
          >
            {ALL_FIELD_TYPES.map((type) => (
              <option key={type} value={type}>{FIELD_TYPE_LABELS[type]}</option>
            ))}
          </Select>
          <Checkbox
            label="Required"
            checked={field.required}
            onChange={(event) => onChange({ required: event.target.checked })}
            className="h-10 rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3"
          />
          <Button type="button" variant="outline" size="sm" onClick={onRemove} icon={<Trash2 className="h-4 w-4" />}>
            Remove
          </Button>
        </div>
      </div>

      {field.type === 'textarea' && (
        <div className="mt-4 max-w-xs">
          <Input
            label="Max words (optional)"
            type="number"
            min={1}
            value={field.validation?.maxWords ?? ''}
            onChange={(event) => onChange({ validation: { ...(field.validation || {}), maxWords: event.target.value ? Number(event.target.value) : undefined } })}
            placeholder="e.g., 400"
          />
        </div>
      )}

      {(field.type === 'text' || field.type === 'email' || field.type === 'tel') && (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Input
            label="Min length (optional)"
            type="number"
            min={0}
            value={field.validation?.minLength ?? ''}
            onChange={(event) => onChange({ validation: { ...(field.validation || {}), minLength: event.target.value ? Number(event.target.value) : undefined } })}
          />
          <Input
            label="Max length (optional)"
            type="number"
            min={1}
            value={field.validation?.maxLength ?? ''}
            onChange={(event) => onChange({ validation: { ...(field.validation || {}), maxLength: event.target.value ? Number(event.target.value) : undefined } })}
          />
          <Input
            label="Pattern (regex, optional)"
            value={field.validation?.pattern ?? ''}
            onChange={(event) => onChange({ validation: { ...(field.validation || {}), pattern: event.target.value || undefined } })}
            placeholder="e.g., ^[0-9]{10}$"
          />
        </div>
      )}

      {field.type === 'number' && (
        <div className="mt-4 grid max-w-md gap-3 sm:grid-cols-2">
          <Input
            label="Min value (optional)"
            type="number"
            value={field.validation?.min ?? ''}
            onChange={(event) => onChange({ validation: { ...(field.validation || {}), min: event.target.value ? Number(event.target.value) : undefined } })}
          />
          <Input
            label="Max value (optional)"
            type="number"
            value={field.validation?.max ?? ''}
            onChange={(event) => onChange({ validation: { ...(field.validation || {}), max: event.target.value ? Number(event.target.value) : undefined } })}
          />
        </div>
      )}

      {field.type === 'date' && (
        <div className="mt-4 max-w-xs">
          <Select
            label="Date captured"
            value={field.validation?.dateMode ?? 'full'}
            onChange={(event) => onChange({ validation: { ...(field.validation || {}), dateMode: event.target.value as 'full' | 'day-month' } })}
          >
            <option value="full">Full date (day, month, year)</option>
            <option value="day-month">Day and month only (e.g. recurring anniversary)</option>
          </Select>
        </div>
      )}

      {isOptionFieldType(field.type) && (
        <div className="mt-4 space-y-3 rounded-[var(--radius-card)] border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">Options</p>
              <p className="text-xs text-[var(--color-text-tertiary)]">Add each dropdown, radio, or checkbox option separately.</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addOption} icon={<Plus className="h-4 w-4" />}>
              Add option
            </Button>
          </div>
          <div className="space-y-2">
            {options.map((option, optionIndex) => (
              <div key={`${field.key || index}-option-${optionIndex}`} className="flex items-center gap-2">
                <Input value={option.label} onChange={(event) => updateOptionLabel(optionIndex, event.target.value)} placeholder={`Option ${optionIndex + 1}`} />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeOption(optionIndex)}
                  disabled={options.length <= 1}
                  icon={<Trash2 className="h-4 w-4" />}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 rounded-[var(--radius-card)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] p-3">
        <Checkbox label="Show this field conditionally" checked={visibilityEnabled} onChange={(event) => setVisibilityEnabled(event.target.checked)} />

        {visibilityEnabled && (
          <div className="mt-3 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Select label="Rule matching" value={visibilityMatch} onChange={(event) => updateVisibilityMatch(event.target.value === 'any' ? 'any' : 'all')}>
                <option value="all">All conditions must pass</option>
                <option value="any">Any condition can pass</option>
              </Select>
              <p className="flex items-end text-xs text-[var(--color-text-tertiary)]">
                Use conditional fields when a follow-up question should only appear after a specific answer.
              </p>
            </div>

            {visibilityRules.map((rule, ruleIndex) => {
              const targetOptions = getTargetOptions(rule.fieldKey);
              const useListInput = usesVisibilityList(rule.operator);
              const scalarValue = typeof rule.value === 'string' ? rule.value : typeof rule.value === 'number' || typeof rule.value === 'boolean' ? String(rule.value) : '';
              const listValue = Array.isArray(rule.values) ? rule.values.map((value) => String(value)).join(', ') : '';
              const canUseOptionSelect = !useListInput && targetOptions.length > 0;

              return (
                <div key={`${field.key || index}-visibility-${ruleIndex}`} className="rounded-[var(--radius-card)] border border-[var(--color-border-primary)] bg-[var(--color-background-primary)] p-3">
                  <div className="grid gap-3 lg:grid-cols-3">
                    <Select label="When field" value={rule.fieldKey} onChange={(event) => updateVisibilityRule(ruleIndex, { fieldKey: event.target.value })}>
                      <option value="">Select a field</option>
                      {targetFields.map((targetField) => (
                        <option key={targetField.key} value={targetField.key}>{targetField.label || targetField.key}</option>
                      ))}
                    </Select>

                    <Select
                      label="Condition"
                      value={rule.operator}
                      onChange={(event) => {
                        const nextOperator = event.target.value as FormFieldCondition['operator'];
                        updateVisibilityRule(ruleIndex, {
                          operator: nextOperator,
                          value: usesVisibilityList(nextOperator) ? undefined : '',
                          values: usesVisibilityList(nextOperator) ? [] : undefined,
                        });
                      }}
                    >
                      {VISIBILITY_OPERATORS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </Select>

                    {canUseOptionSelect ? (
                      <Select label="Value" value={scalarValue} onChange={(event) => updateVisibilityRule(ruleIndex, { value: event.target.value })}>
                        <option value="">Select a value</option>
                        {targetOptions.map((option) => (
                          <option key={`${option.value}-${option.label}`} value={option.value}>{option.label}</option>
                        ))}
                      </Select>
                    ) : (
                      <Input
                        label="Value"
                        value={useListInput ? listValue : scalarValue}
                        onChange={(event) =>
                          updateVisibilityRule(
                            ruleIndex,
                            useListInput
                              ? { values: event.target.value.split(',').map((value) => value.trim()).filter(Boolean) }
                              : { value: event.target.value }
                          )
                        }
                        placeholder={useListInput ? 'yes, maybe' : 'yes'}
                      />
                    )}
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button type="button" variant="outline" size="sm" onClick={() => removeVisibilityRule(ruleIndex)}>
                      Remove Condition
                    </Button>
                  </div>
                </div>
              );
            })}

            <Button type="button" variant="outline" size="sm" onClick={addVisibilityRule}>
              Add Condition
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
