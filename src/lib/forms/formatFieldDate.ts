/* ============================================================================
   Stored form-date formatting. Public-form `date` fields are stored as either
   "DD-MM" (day + month, e.g. a birthday) or "DD-MM-YYYY" (full date). This turns
   those raw strings into something readable for the submission detail view and
   the CSV / PDF / Excel exports — keeping the day-month vs full distinction
   visible instead of dumping "24-12".
============================================================================ */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DD_MM = /^(\d{1,2})-(\d{1,2})$/;
const DD_MM_YYYY = /^(\d{1,2})-(\d{1,2})-(\d{4})$/;

/**
 * "24-12"       → "24 December"
 * "24-12-1990"  → "24 December 1990"
 * anything else → the input unchanged (so unexpected values are never hidden).
 */
export function formatStoredFormDate(value: string): string {
  const raw = (value ?? '').trim();

  const full = DD_MM_YYYY.exec(raw);
  if (full) {
    const [, d, m, y] = full;
    const month = MONTHS[Number(m) - 1];
    if (month) return `${Number(d)} ${month} ${y}`;
  }

  const dm = DD_MM.exec(raw);
  if (dm) {
    const [, d, m] = dm;
    const month = MONTHS[Number(m) - 1];
    if (month) return `${Number(d)} ${month}`;
  }

  return raw;
}

/** True when the raw value looks like a stored form date ("DD-MM" / "DD-MM-YYYY"). */
export function isStoredFormDate(value: unknown): value is string {
  return typeof value === 'string' && (DD_MM.test(value.trim()) || DD_MM_YYYY.test(value.trim()));
}

/* ── Birth-date heuristic — mirrors the public renderer + the Go backend ──── */

// A `date` field keeps the year when its key/label reads as a date of birth.
// Plain "birthday" / "anniversary" are intentionally excluded (day + month only,
// for recurring greeting automation). Keep this in sync with
// Frontend-dev/src/lib/forms/fieldValue.ts and
// Backend-dev/internal/service/form_service_validation.go.
export const BIRTH_DATE_FIELD_RE =
  /\b(d\.?o\.?b|date[\s_-]*of[\s_-]*birth|birth[\s_-]*date)\b/i;

/** How a `date` field is actually captured, honouring the auto-heuristic. */
export function dateFieldKeepsYear(field: {
  key?: string | null;
  label?: string | null;
  validation?: { dateMode?: 'full' | 'day-month' | null } | null;
}): boolean {
  const mode = field.validation?.dateMode;
  if (mode === 'full') return true;
  if (mode === 'day-month') return false;
  return BIRTH_DATE_FIELD_RE.test(`${field.key ?? ''} ${field.label ?? ''}`);
}
