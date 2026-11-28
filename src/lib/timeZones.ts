/** Timezone helpers shared by scheduled campaign and celebration automation forms. */
export function isValidIanaTimeZone(value: string): boolean {
  const timezone = value.trim();
  if (!timezone) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/** Format an absolute timestamp in the timezone that controls its schedule. */
export function formatScheduledDate(value: string | undefined, timezone: string): string {
  if (!value) return 'No future run';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Invalid schedule time';
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: timezone,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(date) + ' UTC';
  }
}

/** Make a calendar date using local calendar arithmetic, not UTC slicing. */
export function localDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Convert an absolute timestamp into the browser-local datetime-local value. */
export function toLocalDateTimeInput(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Convert a datetime-local value into an absolute ISO timestamp. */
export function fromLocalDateTimeInput(value: string): string | null {
  if (!value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
