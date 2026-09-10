import type { Recommendation, Severity } from '@/lib/forms/formAnalytics';

/* ============================================================================
   Church-wide overview — the admin portal's Analytics and Reports pages render
   from ONE server-computed payload (`GET /admin/analytics/overview`). This file
   is only a mapper: it turns the API response into the view-model the pages and
   the executive exports consume. Nothing here estimates or fabricates a number
   — every figure traces to the backend `church_overview_service`.
============================================================================ */

export type { Recommendation, Severity };

/* ── Raw API response (mirrors Go models.ChurchOverview) ──────────────────── */

export interface OverviewMonthPoint {
  month: string; // "YYYY-MM"
  value: number;
}
export interface OverviewMoneyPoint {
  month: string;
  amountKobo: number;
}
export interface OverviewNamedCount {
  name: string;
  count: number;
}
export interface OverviewNamedMoney {
  name: string;
  amountKobo: number;
  count: number;
}
export interface OverviewFormTally {
  formId: string;
  title: string;
  count: number;
}

export interface ChurchOverviewResponse {
  generatedAt: string;
  range: 'month' | 'last30' | 'year';
  window: {
    currentStart: string;
    currentEnd: string;
    previousStart: string;
    previousEnd: string;
  };
  people: {
    membersTotal: number;
    membersActive: number;
    membersMonthly: OverviewMonthPoint[];
    newMembersInRange: number;
    workforceTotal: number;
    workforceServing: number;
    subscribersTotal: number;
    subscribersActive: number;
    subscribersAdded30d: number;
    leadershipTotal: number;
    leadershipByRole: OverviewNamedCount[];
    leadershipByStatus: OverviewNamedCount[];
  };
  intake: {
    submissionsTotal: number;
    submissionsCurrent: number;
    submissionsPrevious: number;
    perForm: OverviewFormTally[];
    newMemberMonthly: OverviewMonthPoint[];
    workflowByStage: OverviewNamedCount[];
    workflowStalled: number;
  };
  giving: {
    thisMonthKobo: number;
    lastMonthKobo: number;
    ytdKobo: number;
    monthly: OverviewMoneyPoint[];
    byCategory: OverviewNamedMoney[];
    byChannel: OverviewNamedMoney[];
    avgGiftKobo: number;
    successCount: number;
    failedCount: number;
    hasData: boolean;
  };
  engagement: {
    attendanceCurrent: number;
    attendancePrevious: number;
    attendanceMonthly: OverviewMonthPoint[];
    attendanceByServiceType: OverviewNamedCount[];
    backlog: {
      prayerOpen: number;
      prayerByStatus: OverviewNamedCount[];
      prayerOldestOpenDays: number;
      contactTotal: number;
      contact30d: number;
      visitsUpcoming: number;
      visitsByStatus: OverviewNamedCount[];
      pastoralByType: OverviewNamedCount[];
      pastoralTotal: number;
      approvalsPending: number;
    };
  };
  ministry: {
    cellGroupsCount: number;
    cellGroupMembers: number;
    cellGroupAvgSize: number;
    cellGroupMeetings30d: number;
    ministriesCount: number;
    ministriesUnstaffed: number;
    membersByMinistry: OverviewNamedCount[];
  };
  content: {
    testimonialsApproved: number;
    testimonialsPending: number;
    testimonials30d: number;
    storeRevenue: number;
    storeOrdersByStatus: OverviewNamedCount[];
    storePaymentPending: number;
  };
  events: {
    total: number;
    upcoming: number;
    byCategory: OverviewNamedCount[];
    monthly: OverviewMonthPoint[];
    hasData: boolean;
  };
  signals: {
    memberActivationRate: number;
    volunteerCoverageRate: number;
    upcomingEventLoadRate: number;
    submissionDeltaPercent: number;
    givingDeltaPercent: number;
    attendanceDeltaPercent: number;
    backlogPressure: number;
    decisionReadinessScore: number;
  };
  recommendations: string[];
}

/* ── View model consumed by the pages + exports ──────────────────────────── */

export interface Trend {
  current: number;
  previous: number;
  /** Percent change vs `previous`; null when there is no prior baseline. */
  deltaPct: number | null;
}

export interface MonthlyPoint {
  key: string; // "YYYY-MM"
  label: string; // "Sep" or "Sep 25"
  value: number;
}

export interface CategoryCount {
  name: string;
  count: number;
}

export interface AttentionItem {
  key: string;
  label: string;
  count: number;
  href: string;
  severity: Severity;
  hint: string;
}

export interface FormIntakeItem {
  formId: string;
  title: string;
  count: number;
}

export interface ChurchOverview {
  generatedAt: string;
  range: 'month' | 'last30' | 'year';
  /** Kept for API symmetry; the single endpoint is authoritative so this is []. */
  missing: string[];

  people: {
    members: { total: number; active: number; activationRate: number };
    memberGrowth: Trend;
    newMembersInRange: number;
    workforce: { total: number; serving: number; coverageRate: number };
    subscribers: { total: number; active: number; added30d: number };
    leadership: number;
    leadershipByRole: CategoryCount[];
  };

  intake: {
    submissionsTotal: number;
    submissions: Trend;
    perForm: FormIntakeItem[];
    newMemberIntakeMonthly: MonthlyPoint[];
    workflowByStage: CategoryCount[];
    workflowStalled: number;
  };

  giving: {
    thisMonthNaira: number;
    lastMonthNaira: number;
    ytdNaira: number;
    avgGiftNaira: number;
    trend: Trend;
    monthly: MonthlyPoint[];
    byCategory: Array<{ name: string; naira: number; count: number }>;
    byChannel: Array<{ name: string; naira: number; count: number }>;
    successCount: number;
    failedCount: number;
    hasData: boolean;
  };

  engagement: {
    attendance: Trend;
    attendanceMonthly: MonthlyPoint[];
    attendanceByServiceType: CategoryCount[];
    attention: AttentionItem[];
  };

  ministry: {
    cellGroups: number;
    cellGroupMembers: number;
    cellGroupAvgSize: number;
    cellGroupMeetings30d: number;
    ministries: number;
    ministriesUnstaffed: number;
    membersByMinistry: CategoryCount[];
  };

  content: {
    testimonialsApproved: number;
    testimonialsPending: number;
    testimonials30d: number;
    storeRevenue: number;
    storeOrdersByStatus: CategoryCount[];
    storePaymentPending: number;
  };

  events: {
    total: number;
    upcoming: number;
    byCategory: CategoryCount[];
    monthly: MonthlyPoint[];
    hasData: boolean;
  };

  signals: {
    readinessScore: number;
    activationRate: number;
    volunteerCoverage: number;
    submissionDeltaPct: number;
    givingDeltaPct: number;
    attendanceDeltaPct: number;
    backlogPressure: number;
  };

  recommendations: Recommendation[];

  monthly: {
    members: MonthlyPoint[];
    giving: MonthlyPoint[];
    newMemberIntake: MonthlyPoint[];
  };
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function trend(current: number, previous: number): Trend {
  let deltaPct: number | null;
  if (previous > 0) deltaPct = Math.round(((current - previous) / previous) * 100);
  else if (current > 0) deltaPct = 100;
  else deltaPct = null;
  return { current, previous, deltaPct };
}

function nairaFromKobo(kobo: number): number {
  return Math.round((kobo || 0) / 100);
}

function monthLabel(key: string, crossesYear: boolean): string {
  const [y, m] = key.split('-').map(Number);
  const idx = (m ?? 1) - 1;
  const name = MONTH_LABELS[idx] ?? key;
  return crossesYear ? `${name} ${String(y).slice(2)}` : name;
}

function toPoints(series: OverviewMonthPoint[] | undefined): MonthlyPoint[] {
  const rows = series ?? [];
  const years = new Set(rows.map((r) => r.month.slice(0, 4)));
  const crossesYear = years.size > 1;
  return rows.map((r) => ({
    key: r.month,
    label: monthLabel(r.month, crossesYear),
    value: r.value ?? 0,
  }));
}

function moneyToPoints(series: OverviewMoneyPoint[] | undefined): MonthlyPoint[] {
  const rows = series ?? [];
  const years = new Set(rows.map((r) => r.month.slice(0, 4)));
  const crossesYear = years.size > 1;
  return rows.map((r) => ({
    key: r.month,
    label: monthLabel(r.month, crossesYear),
    value: nairaFromKobo(r.amountKobo ?? 0),
  }));
}

function named(list: OverviewNamedCount[] | undefined): CategoryCount[] {
  return (list ?? []).map((r) => ({ name: r.name, count: r.count ?? 0 }));
}

function lastTwoTrend(points: MonthlyPoint[]): Trend {
  if (points.length < 2) return trend(points[points.length - 1]?.value ?? 0, 0);
  return trend(points[points.length - 1].value, points[points.length - 2].value);
}

function severityFor(count: number, warnAt: number): Severity {
  if (count >= Math.max(warnAt * 3, 10)) return 'critical';
  if (count >= warnAt) return 'warn';
  return 'info';
}

/** Turn the API response into the page/export view model. */
export function mapOverview(resp: ChurchOverviewResponse): ChurchOverview {
  const p = resp.people;
  const membersMonthly = toPoints(p.membersMonthly);
  const givingMonthly = moneyToPoints(resp.giving.monthly);
  const newMemberMonthly = toPoints(resp.intake.newMemberMonthly);
  const attendanceMonthly = toPoints(resp.engagement.attendanceMonthly);

  const activationRate =
    resp.signals.memberActivationRate ||
    (p.membersTotal > 0 ? p.membersActive / p.membersTotal : 0);
  const coverageRate =
    resp.signals.volunteerCoverageRate ||
    (p.workforceTotal > 0 ? p.workforceServing / p.workforceTotal : 0);

  const b = resp.engagement.backlog;
  const attention: AttentionItem[] = [
    {
      key: 'approvals',
      label: 'Approvals awaiting decision',
      count: b.approvalsPending,
      href: '/dashboard/super/requests',
      hint: 'Content or record changes need a super-admin sign-off.',
      severity: severityFor(b.approvalsPending, 1),
    },
    {
      key: 'prayer',
      label: 'Open prayer requests',
      count: b.prayerOpen,
      href: '/dashboard/prayer-requests',
      hint:
        b.prayerOldestOpenDays > 0
          ? `Oldest has been open ${b.prayerOldestOpenDays} days.`
          : 'Requests still marked pending or being prayed over.',
      severity: severityFor(b.prayerOpen, 3),
    },
    {
      key: 'contact',
      label: 'Contact messages (30d)',
      count: b.contact30d,
      href: '/dashboard/contact-messages',
      hint: `${b.contactTotal} total from the website contact form.`,
      severity: severityFor(b.contact30d, 5),
    },
    {
      key: 'visits',
      label: 'Upcoming visits to prepare',
      count: b.visitsUpcoming,
      href: '/dashboard/visits',
      hint: 'People who told us they are coming and need follow-up.',
      severity: severityFor(b.visitsUpcoming, 1),
    },
    {
      key: 'workflow',
      label: 'Stalled new-member journeys',
      count: resp.intake.workflowStalled,
      href: '/dashboard/new-members',
      hint: 'No activity for over two weeks.',
      severity: severityFor(resp.intake.workflowStalled, 3),
    },
  ].sort((a, c) => {
    const rank = { critical: 0, warn: 1, info: 2 } as const;
    return rank[a.severity] - rank[c.severity] || c.count - a.count;
  });

  const recommendations: Recommendation[] = (resp.recommendations ?? []).map(
    (text) => ({
      severity: /drop|down|stall|low|below|behind|risk|overdue/i.test(text)
        ? 'warn'
        : 'info',
      title: 'Decision engine',
      detail: text,
    })
  );
  if (recommendations.length === 0) {
    recommendations.push({
      severity: 'info',
      title: 'Nothing needs attention',
      detail:
        'Growth, giving, attendance, backlogs and volunteer coverage are all within a healthy range.',
    });
  }

  return {
    generatedAt: resp.generatedAt,
    range: resp.range,
    missing: [],
    people: {
      members: { total: p.membersTotal, active: p.membersActive, activationRate },
      memberGrowth: lastTwoTrend(membersMonthly),
      newMembersInRange: p.newMembersInRange,
      workforce: {
        total: p.workforceTotal,
        serving: p.workforceServing,
        coverageRate,
      },
      subscribers: {
        total: p.subscribersTotal,
        active: p.subscribersActive,
        added30d: p.subscribersAdded30d,
      },
      leadership: p.leadershipTotal,
      leadershipByRole: named(p.leadershipByRole),
    },
    intake: {
      submissionsTotal: resp.intake.submissionsTotal,
      submissions: trend(
        resp.intake.submissionsCurrent,
        resp.intake.submissionsPrevious
      ),
      perForm: (resp.intake.perForm ?? []).map((f) => ({
        formId: f.formId,
        title: f.title,
        count: f.count,
      })),
      newMemberIntakeMonthly: newMemberMonthly,
      workflowByStage: named(resp.intake.workflowByStage),
      workflowStalled: resp.intake.workflowStalled,
    },
    giving: {
      thisMonthNaira: nairaFromKobo(resp.giving.thisMonthKobo),
      lastMonthNaira: nairaFromKobo(resp.giving.lastMonthKobo),
      ytdNaira: nairaFromKobo(resp.giving.ytdKobo),
      avgGiftNaira: nairaFromKobo(resp.giving.avgGiftKobo),
      trend: trend(
        nairaFromKobo(resp.giving.thisMonthKobo),
        nairaFromKobo(resp.giving.lastMonthKobo)
      ),
      monthly: givingMonthly,
      byCategory: (resp.giving.byCategory ?? []).map((r) => ({
        name: r.name,
        naira: nairaFromKobo(r.amountKobo),
        count: r.count,
      })),
      byChannel: (resp.giving.byChannel ?? []).map((r) => ({
        name: r.name,
        naira: nairaFromKobo(r.amountKobo),
        count: r.count,
      })),
      successCount: resp.giving.successCount,
      failedCount: resp.giving.failedCount,
      hasData: resp.giving.hasData,
    },
    engagement: {
      attendance: trend(
        resp.engagement.attendanceCurrent,
        resp.engagement.attendancePrevious
      ),
      attendanceMonthly,
      attendanceByServiceType: named(resp.engagement.attendanceByServiceType),
      attention,
    },
    ministry: {
      cellGroups: resp.ministry.cellGroupsCount,
      cellGroupMembers: resp.ministry.cellGroupMembers,
      cellGroupAvgSize: resp.ministry.cellGroupAvgSize,
      cellGroupMeetings30d: resp.ministry.cellGroupMeetings30d,
      ministries: resp.ministry.ministriesCount,
      ministriesUnstaffed: resp.ministry.ministriesUnstaffed,
      membersByMinistry: named(resp.ministry.membersByMinistry),
    },
    content: {
      testimonialsApproved: resp.content.testimonialsApproved,
      testimonialsPending: resp.content.testimonialsPending,
      testimonials30d: resp.content.testimonials30d,
      storeRevenue: resp.content.storeRevenue,
      storeOrdersByStatus: named(resp.content.storeOrdersByStatus),
      storePaymentPending: resp.content.storePaymentPending,
    },
    events: {
      total: resp.events.total,
      upcoming: resp.events.upcoming,
      byCategory: named(resp.events.byCategory),
      monthly: toPoints(resp.events.monthly),
      hasData: resp.events.hasData,
    },
    signals: {
      readinessScore: resp.signals.decisionReadinessScore,
      activationRate,
      volunteerCoverage: coverageRate,
      submissionDeltaPct: resp.signals.submissionDeltaPercent,
      givingDeltaPct: resp.signals.givingDeltaPercent,
      attendanceDeltaPct: resp.signals.attendanceDeltaPercent,
      backlogPressure: resp.signals.backlogPressure,
    },
    recommendations,
    monthly: {
      members: membersMonthly,
      giving: givingMonthly,
      newMemberIntake: newMemberMonthly,
    },
  };
}

/* ── formatting helpers shared by the pages + exports ────────────────────── */

export function formatNaira(value: number): string {
  return `₦${Math.round(value || 0).toLocaleString('en-NG')}`;
}

export function formatDeltaPct(delta: number | null): string {
  if (delta === null) return 'new';
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta}%`;
}

export function formatPercent(ratio: number): string {
  return `${Math.round((ratio || 0) * 100)}%`;
}

export const RANGE_LABELS: Record<ChurchOverview['range'], string> = {
  month: 'This month',
  last30: 'Last 30 days',
  year: 'This year',
};
