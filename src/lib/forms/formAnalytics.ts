import type { FormSubmission } from '../types';
import { normalizeEmail, validateEmail } from '../utils';
import {
  buildFieldLabelMap,
  resolveExportFieldLabel,
  serializeSubmissionValue,
  type ExportFormField,
} from './formSubmissions';

/* ============================================================================
   Form analytics — one pure `buildFormAnalytics(submissions, fields)` that the
   report page, the report PDF, and the Excel workbook all render from. No React,
   no charts here: just the numbers, the breakdowns, and the recommendations.
============================================================================ */

export type Severity = 'info' | 'warn' | 'critical';

export interface Recommendation {
  severity: Severity;
  title: string;
  detail: string;
}

export interface OptionBreakdown {
  label: string;
  value: string;
  count: number;
  percent: number;
}

export interface AgeBreakdown {
  bucket: string;
  count: number;
  percent: number;
}

export interface FieldInsight {
  key: string;
  label: string;
  type: string;
  required: boolean;
  /** Submissions where this field held a non-blank answer. */
  responded: number;
  /** responded / total, 0–1. */
  responseRate: number;
  /** select / radio / checkbox distribution. */
  options?: OptionBreakdown[];
  /** number field stats. */
  numeric?: { min: number; max: number; mean: number; median: number };
  /** detected date-of-birth field. */
  ageGroups?: AgeBreakdown[];
  meanAgeYears?: number;
}

export interface DailyPoint {
  date: string; // YYYY-MM-DD
  count: number;
}

export interface FormAnalytics {
  total: number;
  firstAt: string | null;
  lastAt: string | null;
  last7: number;
  prev7: number;
  trend7: number | null; // percent change vs previous 7 days
  last30: number;
  prev30: number;
  busiestDay: DailyPoint | null;
  busiestWeekday: string | null;
  avgFieldsCompleted: number;
  /** Mean of (answered required / total required) across submissions, 0–1. */
  completionRate: number;
  dailySeries: DailyPoint[]; // last 30 days, zero-filled
  fields: FieldInsight[];
  recommendations: Recommendation[];
}

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const LOOSE_PHONE_RE = /^[+()\d][\d\s().-]{5,}$/;

function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'boolean') return value === false;
  return false;
}

function valueToStrings(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  const single = serializeSubmissionValue(value).trim();
  return single ? [single] : [];
}

function isDobField(field: ExportFormField): boolean {
  if (field.type === 'date' && field.validation?.dateMode === 'full') return true;
  return /\b(dob|date[_\s-]?of[_\s-]?birth|birth[_\s-]?date|birthday)\b/i.test(
    `${field.key} ${field.label}`
  );
}

/** Age in whole years from a "DD-MM-YYYY" (or DD/MM/YYYY, YYYY-MM-DD) value. */
function ageFromDob(raw: string): number | null {
  const trimmed = raw.trim();
  let day: number, month: number, year: number;

  let m = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(trimmed);
  if (m) {
    day = Number(m[1]);
    month = Number(m[2]);
    year = Number(m[3]);
  } else {
    m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
    if (!m) return null;
    year = Number(m[1]);
    month = Number(m[2]);
    day = Number(m[3]);
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const born = new Date(year, month - 1, day);
  if (Number.isNaN(born.getTime())) return null;

  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const beforeBirthday =
    now.getMonth() < born.getMonth() ||
    (now.getMonth() === born.getMonth() && now.getDate() < born.getDate());
  if (beforeBirthday) age -= 1;
  if (age < 0 || age > 120) return null;
  return age;
}

function ageBucket(age: number): string {
  if (age <= 2) return '0–2';
  if (age <= 5) return '3–5';
  if (age <= 8) return '6–8';
  if (age <= 12) return '9–12';
  if (age <= 17) return '13–17';
  return '18+';
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function countBetween(times: number[], startMs: number, endMs: number): number {
  return times.filter((t) => t >= startMs && t < endMs).length;
}

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;
}

export function buildFormAnalytics(
  submissions: FormSubmission[],
  fields: ExportFormField[] = []
): FormAnalytics {
  const total = submissions.length;
  const labelMap = buildFieldLabelMap(fields);

  const times = submissions
    .map((s) => new Date(s.createdAt).getTime())
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => a - b);

  const firstAt = times.length ? new Date(times[0]).toISOString() : null;
  const lastAt = times.length
    ? new Date(times[times.length - 1]).toISOString()
    : null;

  const now = Date.now();
  const DAY = 86_400_000;
  const last7 = countBetween(times, now - 7 * DAY, now + DAY);
  const prev7 = countBetween(times, now - 14 * DAY, now - 7 * DAY);
  const last30 = countBetween(times, now - 30 * DAY, now + DAY);
  const prev30 = countBetween(times, now - 60 * DAY, now - 30 * DAY);
  const trend7 = prev7 > 0 ? Math.round(((last7 - prev7) / prev7) * 100) : null;

  // Daily series (last 30 days, zero-filled) + busiest day / weekday.
  const dayCounts = new Map<string, number>();
  const weekdayCounts = new Array(7).fill(0) as number[];
  submissions.forEach((s) => {
    const d = new Date(s.createdAt);
    if (Number.isNaN(d.getTime())) return;
    const key = toISODate(d);
    dayCounts.set(key, (dayCounts.get(key) ?? 0) + 1);
    weekdayCounts[d.getDay()] += 1;
  });

  const dailySeries: DailyPoint[] = [];
  for (let i = 29; i >= 0; i -= 1) {
    const d = new Date(now - i * DAY);
    const key = toISODate(d);
    dailySeries.push({ date: key, count: dayCounts.get(key) ?? 0 });
  }

  let busiestDay: DailyPoint | null = null;
  dayCounts.forEach((count, date) => {
    if (!busiestDay || count > busiestDay.count) busiestDay = { date, count };
  });

  const maxWeekday = Math.max(...weekdayCounts);
  const busiestWeekday =
    total > 0 && maxWeekday > 0
      ? WEEKDAYS[weekdayCounts.indexOf(maxWeekday)]
      : null;

  // ── Per-field ───────────────────────────────────────────────────────────
  const orderedFields = fields
    .filter((f) => f.key && !f.key.startsWith('_'))
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const requiredKeys = orderedFields.filter((f) => f.required).map((f) => f.key);

  let fieldsCompletedSum = 0;
  let completionSum = 0;
  submissions.forEach((s) => {
    const values = s.values || {};
    const answered = orderedFields.filter(
      (f) => !isBlank(values[f.key])
    ).length;
    fieldsCompletedSum += answered;
    if (requiredKeys.length > 0) {
      const answeredRequired = requiredKeys.filter(
        (k) => !isBlank(values[k])
      ).length;
      completionSum += answeredRequired / requiredKeys.length;
    } else {
      completionSum += orderedFields.length > 0 ? answered / orderedFields.length : 1;
    }
  });

  const avgFieldsCompleted =
    total > 0 ? Math.round((fieldsCompletedSum / total) * 10) / 10 : 0;
  const completionRate = total > 0 ? completionSum / total : 0;

  const fieldInsights: FieldInsight[] = orderedFields.map((field) => {
    const label = resolveExportFieldLabel(field.key, labelMap);
    const answers = submissions
      .map((s) => (s.values || {})[field.key])
      .filter((v) => !isBlank(v));
    const responded = answers.length;

    const insight: FieldInsight = {
      key: field.key,
      label,
      type: field.type,
      required: Boolean(field.required),
      responded,
      responseRate: total > 0 ? responded / total : 0,
    };

    if (isDobField(field)) {
      const buckets = new Map<string, number>();
      let ageSum = 0;
      let ageN = 0;
      answers.forEach((v) => {
        const age = ageFromDob(serializeSubmissionValue(v));
        if (age === null) return;
        ageSum += age;
        ageN += 1;
        const b = ageBucket(age);
        buckets.set(b, (buckets.get(b) ?? 0) + 1);
      });
      if (ageN > 0) {
        const order = ['0–2', '3–5', '6–8', '9–12', '13–17', '18+'];
        insight.ageGroups = order
          .filter((b) => buckets.has(b))
          .map((b) => ({
            bucket: b,
            count: buckets.get(b) ?? 0,
            percent: pct(buckets.get(b) ?? 0, ageN),
          }));
        insight.meanAgeYears = Math.round((ageSum / ageN) * 10) / 10;
      }
      return insight;
    }

    if (
      field.type === 'select' ||
      field.type === 'radio' ||
      field.type === 'checkbox'
    ) {
      const optionLabel = new Map<string, string>();
      (field.options || []).forEach((o) => {
        optionLabel.set(String(o.value), o.label || String(o.value));
      });
      const counts = new Map<string, number>();
      answers.forEach((v) => {
        valueToStrings(v).forEach((token) => {
          counts.set(token, (counts.get(token) ?? 0) + 1);
        });
      });
      const denom = responded || 1;
      insight.options = Array.from(counts.entries())
        .map(([value, count]) => ({
          value,
          label: optionLabel.get(value) ?? value,
          count,
          percent: pct(count, denom),
        }))
        .sort((a, b) => b.count - a.count);
      return insight;
    }

    if (field.type === 'number') {
      const nums = answers
        .map((v) => Number(serializeSubmissionValue(v)))
        .filter((n) => Number.isFinite(n))
        .sort((a, b) => a - b);
      if (nums.length > 0) {
        const sum = nums.reduce((acc, n) => acc + n, 0);
        const mid = Math.floor(nums.length / 2);
        insight.numeric = {
          min: nums[0],
          max: nums[nums.length - 1],
          mean: Math.round((sum / nums.length) * 100) / 100,
          median:
            nums.length % 2 === 0
              ? (nums[mid - 1] + nums[mid]) / 2
              : nums[mid],
        };
      }
      return insight;
    }

    return insight;
  });

  // ── Recommendations ─────────────────────────────────────────────────────
  const recommendations: Recommendation[] = [];

  if (total === 0) {
    recommendations.push({
      severity: 'info',
      title: 'No submissions yet',
      detail:
        'Share the form link. Analysis appears here once responses start coming in.',
    });
  }

  fieldInsights.forEach((f) => {
    if (total < 3) return;
    const blankRate = 1 - f.responseRate;
    if (f.required && blankRate > 0.2) {
      recommendations.push({
        severity: 'warn',
        title: `"${f.label}" is often left blank`,
        detail: `${Math.round(blankRate * 100)}% of submissions skipped this required question. It may be unclear or hard to answer — consider rewording it or making it optional.`,
      });
    } else if (!f.required && blankRate > 0.5) {
      recommendations.push({
        severity: 'info',
        title: `Low response on "${f.label}"`,
        detail: `Only ${Math.round(f.responseRate * 100)}% answered this optional question. Consider removing it to shorten the form, or making it clearer.`,
      });
    }
  });

  // Email / phone quality + duplicates.
  const emailFields = orderedFields.filter(
    (f) => f.type === 'email' || /\bemail\b/i.test(`${f.key} ${f.label}`)
  );
  const phoneFields = orderedFields.filter(
    (f) => f.type === 'tel' || /\b(phone|mobile|tel|contact\s*number)\b/i.test(`${f.key} ${f.label}`)
  );

  const collect = (keys: string[]) =>
    submissions.flatMap((s) =>
      keys
        .map((k) => serializeSubmissionValue((s.values || {})[k]).trim())
        .filter(Boolean)
    );

  const emails = collect(emailFields.map((f) => f.key));
  const badEmails = emails.filter((e) => !validateEmail(e)).length;
  if (badEmails > 0) {
    recommendations.push({
      severity: 'warn',
      title: `${badEmails} email address${badEmails === 1 ? '' : 'es'} look invalid`,
      detail:
        'Some submitted emails are not valid addresses. Confirmation emails to those people will bounce.',
    });
  }

  const phones = collect(phoneFields.map((f) => f.key));
  const badPhones = phones.filter((p) => !LOOSE_PHONE_RE.test(p)).length;
  if (badPhones > 0) {
    recommendations.push({
      severity: 'info',
      title: `${badPhones} phone number${badPhones === 1 ? '' : 's'} may be malformed`,
      detail:
        'Some phone entries do not look like real numbers — worth checking before you rely on them.',
    });
  }

  const dupCount = (list: string[], norm: (v: string) => string) => {
    const seen = new Map<string, number>();
    list.forEach((v) => {
      const key = norm(v);
      seen.set(key, (seen.get(key) ?? 0) + 1);
    });
    return Array.from(seen.values()).filter((n) => n >= 2).length;
  };

  const dupEmails = dupCount(emails, normalizeEmail);
  if (dupEmails > 0) {
    recommendations.push({
      severity: 'warn',
      title: `${dupEmails} email${dupEmails === 1 ? '' : 's'} used on more than one submission`,
      detail:
        'Possible duplicate entries, or one person registering several times (e.g. multiple children). Review before treating each row as a unique person.',
    });
  }

  if (prev7 >= 3 && last7 <= prev7 * 0.6) {
    recommendations.push({
      severity: 'warn',
      title: 'Submissions have slowed down',
      detail: `${last7} in the last 7 days vs ${prev7} the week before (${Math.round((1 - last7 / prev7) * 100)}% down). Consider resharing the link or checking it still works.`,
    });
  }

  if (lastAt) {
    const daysSince = Math.floor((now - new Date(lastAt).getTime()) / DAY);
    if (daysSince >= 14 && total > 0) {
      recommendations.push({
        severity: 'info',
        title: `No new submissions in ${daysSince} days`,
        detail:
          'If the form should still be collecting responses, check that the link is published and shared.',
      });
    }
  }

  if (recommendations.length === 0 && total >= 3) {
    recommendations.push({
      severity: 'info',
      title: 'Nothing to flag',
      detail:
        'Response rates, contact details, and submission volume all look healthy.',
    });
  }

  return {
    total,
    firstAt,
    lastAt,
    last7,
    prev7,
    trend7,
    last30,
    prev30,
    busiestDay,
    busiestWeekday,
    avgFieldsCompleted,
    completionRate,
    dailySeries,
    fields: fieldInsights,
    recommendations,
  };
}
