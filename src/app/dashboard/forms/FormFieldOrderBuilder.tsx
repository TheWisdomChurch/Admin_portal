'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react';

import {
  moveOrderedField,
  moveOrderedFieldByKey,
  normalizeOrderedFields,
  type OrderedFormField,
} from '@/lib/formFieldOrdering';

type FormFieldOrderBuilderProps<T extends OrderedFormField> = {
  fields: T[];
  onChange: (fields: T[]) => void;
  title?: string;
  description?: string;
  className?: string;
};

export default function FormFieldOrderBuilder<T extends OrderedFormField>({
  fields,
  onChange,
  title = 'Arrange form fields',
  description = 'Drag fields into the order users should see, or use the arrow buttons for precise ordering.',
  className = '',
}: FormFieldOrderBuilderProps<T>) {
  const [draggedFieldKey, setDraggedFieldKey] = useState<string | null>(null);
  const [dragOverFieldKey, setDragOverFieldKey] = useState<string | null>(null);

  const orderedFields = useMemo(() => normalizeOrderedFields(fields), [fields]);

  const moveByIndex = (fromIndex: number, toIndex: number) => {
    onChange(moveOrderedField(fields, fromIndex, toIndex));
  };

  const moveByKey = (sourceKey: string, targetKey: string) => {
    onChange(moveOrderedFieldByKey(fields, sourceKey, targetKey));
  };

  return (
    <section className={`rounded-[2rem] border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-4 shadow-sm sm:p-5 ${className}`}>
      <div className="flex flex-col gap-3 border-b border-[var(--color-border-secondary)] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--color-text-tertiary)]">
            Field order
          </p>
          <h2 className="mt-1 text-lg font-black tracking-tight text-[var(--color-text-primary)]">
            {title}
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--color-text-tertiary)]">
            {description}
          </p>
        </div>

        <div className="rounded-2xl bg-[var(--color-background-secondary)] px-3 py-2 text-xs font-bold text-[var(--color-text-secondary)] ring-1 ring-[var(--color-border-secondary)]">
          {orderedFields.length} {orderedFields.length === 1 ? 'field' : 'fields'}
        </div>
      </div>

      {orderedFields.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-5 text-sm font-semibold text-[var(--color-text-tertiary)]">
          No fields yet. Add a field first, then arrange it here.
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {orderedFields.map((field, index) => {
            const isDragging = draggedFieldKey === field.key;
            const isDropTarget = dragOverFieldKey === field.key && draggedFieldKey !== field.key;
            const fieldTitle = field.label || field.key || 'Untitled field';

            return (
              <div
                key={`field-order-${field.key || index}`}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', field.key);
                  setDraggedFieldKey(field.key);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                  setDragOverFieldKey(field.key);
                }}
                onDragLeave={() => {
                  setDragOverFieldKey((current) => (current === field.key ? null : current));
                }}
                onDrop={(event) => {
                  event.preventDefault();

                  const sourceKey = event.dataTransfer.getData('text/plain') || draggedFieldKey;

                  if (sourceKey && sourceKey !== field.key) {
                    moveByKey(sourceKey, field.key);
                  }

                  setDraggedFieldKey(null);
                  setDragOverFieldKey(null);
                }}
                onDragEnd={() => {
                  setDraggedFieldKey(null);
                  setDragOverFieldKey(null);
                }}
                className={`group flex items-center gap-3 rounded-2xl border bg-[var(--color-background-primary)] p-3 shadow-sm transition ${
                  isDropTarget
                    ? 'border-[var(--color-accent-primary)] ring-2 ring-[var(--color-accent-primary)]/30'
                    : 'border-[var(--color-border-secondary)] hover:border-[var(--color-border-primary)] hover:shadow-md'
                } ${isDragging ? 'opacity-60' : ''}`}
              >
                <div className="flex h-10 w-10 shrink-0 cursor-grab items-center justify-center rounded-xl bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] active:cursor-grabbing">
                  <GripVertical className="h-4 w-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[var(--color-background-secondary)] px-2 py-0.5 text-xs font-black text-[var(--color-text-tertiary)]">
                      #{index + 1}
                    </span>

                    <p className="truncate text-sm font-black text-[var(--color-text-primary)]">
                      {fieldTitle}
                    </p>

                    {field.required ? (
                      <span className="rounded-full bg-[var(--color-danger-surface)] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[var(--color-danger-text)] ring-1 ring-[var(--color-danger-border)]">
                        Required
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-1 truncate text-xs font-semibold text-[var(--color-text-tertiary)]">
                    {field.key || 'field_key'} • {field.type || 'field'}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveByIndex(index, index - 1)}
                    disabled={index === 0}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--color-border-secondary)] text-[var(--color-text-tertiary)] transition hover:bg-[var(--color-background-secondary)] disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label={`Move ${fieldTitle} up`}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => moveByIndex(index, index + 1)}
                    disabled={index === orderedFields.length - 1}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--color-border-secondary)] text-[var(--color-text-tertiary)] transition hover:bg-[var(--color-background-secondary)] disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label={`Move ${fieldTitle} down`}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
