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
    <section className={`rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5 ${className}`}>
      <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Field order
          </p>
          <h2 className="mt-1 text-lg font-black tracking-tight text-slate-950">
            {title}
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            {description}
          </p>
        </div>

        <div className="rounded-2xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 ring-1 ring-slate-200">
          {orderedFields.length} {orderedFields.length === 1 ? 'field' : 'fields'}
        </div>
      </div>

      {orderedFields.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm font-semibold text-slate-500">
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
                className={`group flex items-center gap-3 rounded-2xl border bg-white p-3 shadow-sm transition ${
                  isDropTarget
                    ? 'border-amber-400 ring-2 ring-amber-200'
                    : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
                } ${isDragging ? 'opacity-60' : ''}`}
              >
                <div className="flex h-10 w-10 shrink-0 cursor-grab items-center justify-center rounded-xl bg-slate-950 text-white active:cursor-grabbing">
                  <GripVertical className="h-4 w-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-black text-slate-500">
                      #{index + 1}
                    </span>

                    <p className="truncate text-sm font-black text-slate-950">
                      {fieldTitle}
                    </p>

                    {field.required ? (
                      <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-rose-600 ring-1 ring-rose-100">
                        Required
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-1 truncate text-xs font-semibold text-slate-500">
                    {field.key || 'field_key'} • {field.type || 'field'}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveByIndex(index, index - 1)}
                    disabled={index === 0}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label={`Move ${fieldTitle} up`}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => moveByIndex(index, index + 1)}
                    disabled={index === orderedFields.length - 1}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
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
