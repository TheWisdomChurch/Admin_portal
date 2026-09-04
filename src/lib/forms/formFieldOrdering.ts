export type OrderedFormField = {
  key: string;
  label?: string;
  type?: string;
  required?: boolean;
  order?: number;
};

// `field_${fields.length + 1}` (the old default) collides as soon as a field
// earlier in the array has been removed or a preset already used that slot —
// e.g. delete field 3 of 9, add a new one, and both the survivor and the
// newcomer end up keyed "field_9". Walk past every key already in use so a
// freshly added field can never collide with one already on the form.
export function nextUniqueFieldKey<T extends { key?: string }>(fields: T[]): string {
  const used = new Set(fields.map((field) => field.key).filter(Boolean));
  let n = fields.length + 1;
  let key = `field_${n}`;
  while (used.has(key)) {
    n += 1;
    key = `field_${n}`;
  }
  return key;
}

function safeOrder(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return fallback;
}

export function normalizeOrderedFields<T extends OrderedFormField>(fields: T[]): T[] {
  return fields
    .map((field, index) => ({
      ...field,
      order: safeOrder(field.order, index + 1),
    }))
    .sort((left, right) => {
      const leftOrder = safeOrder(left.order, 9999);
      const rightOrder = safeOrder(right.order, 9999);

      if (leftOrder !== rightOrder) return leftOrder - rightOrder;

      return String(left.key || '').localeCompare(String(right.key || ''));
    })
    .map((field, index) => ({
      ...field,
      order: index + 1,
    })) as T[];
}

export function moveOrderedField<T extends OrderedFormField>(
  fields: T[],
  fromIndex: number,
  toIndex: number
): T[] {
  const ordered = normalizeOrderedFields(fields);

  if (fromIndex < 0 || fromIndex >= ordered.length) return ordered;
  if (toIndex < 0 || toIndex >= ordered.length) return ordered;
  if (fromIndex === toIndex) return ordered;

  const next = [...ordered];
  const [removed] = next.splice(fromIndex, 1);

  if (!removed) return ordered;

  next.splice(toIndex, 0, removed);

  return next.map((field, index) => ({
    ...field,
    order: index + 1,
  })) as T[];
}

export function moveOrderedFieldByKey<T extends OrderedFormField>(
  fields: T[],
  sourceKey: string,
  targetKey: string
): T[] {
  const ordered = normalizeOrderedFields(fields);
  const sourceIndex = ordered.findIndex((field) => field.key === sourceKey);
  const targetIndex = ordered.findIndex((field) => field.key === targetKey);

  if (sourceIndex === -1 || targetIndex === -1) return ordered;

  return moveOrderedField(ordered, sourceIndex, targetIndex);
}
