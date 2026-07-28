export type OrderedFormField = {
  key: string;
  label?: string;
  type?: string;
  required?: boolean;
  order?: number;
};

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
