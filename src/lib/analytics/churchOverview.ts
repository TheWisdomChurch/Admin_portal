import type {
  AdminEmailMarketingSummary,
  ApprovalRequest,
  DashboardAnalytics,
  DecisionInsights,
  FormStatsResponse,
  GivingMonthlySummaryRow,
  MemberStatsResponse,
  NewMemberDashboardResponse,
  SubscriberSummary,
  WorkforceStatsResponse,
} from '@/lib/types';
import type { Recommendation, Severity } from '@/lib/forms/formAnalytics';

/* ============================================================================
   Church-wide overview — one pure `buildChurchOverview(sources)` that the
   super-admin Analytics page, the Reports page, and the executive exports all
   render from. Every source is optional: the pages fetch them with
   `Promise.allSettled` and pass whatever came back.
============================================================================ */

export type { Recommendation, Severity };

export interface Trend {
  current: number;
  previous: number;
  /** Percent change vs `previous`; null when there is no prior baseline. */
  deltaPct: number | null;
}

export interface MonthlyPoint {
  /** "YYYY-MM" */
  key: string;
  /** "Sep" or "Sep 25" when the range crosses a year */
  label: string;
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
  /** Sources that failed to load — surfaced so the page can say "partial". */
  missing: string[];

  people: {
    members: { total: number; active: number; activationRate: number };
    memberGrowth: Trend;
    newMembers30d: number;
    workforce: { total: number; serving: number; coverageRate: number };
    subscribers: { total: number; active: number; added30d: number };
    leadership: number;
  };

  intake: {
    submissionsTotal: number;
    submissions30d: Trend;
    perForm: FormIntakeItem[];
    newMemberIntakeMonthly: MonthlyPoint[];
  };

  giving: {
    thisMonthNaira: number;
    lastMonthNaira: number;
    ytdNaira: number;
    trend: Trend;
    monthly: MonthlyPoint[];
    hasData: boolean;
  };

  engagement: {
    attendance30d: Trend;
    attention: AttentionItem[];
  };

  ministry: {
    cellGroups: number;
    ministries: number;
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
  };

  recommendations: Recommendation[];

  monthly: {
    members: MonthlyPoint[];
    giving: MonthlyPoint[];
    newMemberIntake: MonthlyPoint[];
  };
}

export interface OverviewSources {
  analytics?: DashboardAnalytics | null;
  insights?: DecisionInsights | null;
  formStats?: FormStatsResponse | null;
  memberStats?: MemberStatsResponse | null;
  workforceStats?: WorkforceStatsResponse | null;
  givingMonthly?: GivingMonthlySummaryRow[] | null;
  approvals?: ApprovalRequest[] | null;
  newMembers?: NewMemberDashboardResponse | null;
  emailSummary?: AdminEmailMarketingSummary | null;
  subscribers?: SubscriberSummary | null;
  prayerTotalPending?: number | null;
  contactTotal?: number | null;
  visitsPending?: number | null;
  cellGroups?: number | null;
  ministries?: number | null;
  leadership?: number | null;
}

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
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

/** Last N calendar months (oldest first), zero-filled, from a
 *  {key:"YYYY-MM" -> value} map. */
function lastMonths(map: Map<string, number>, count = 12): MonthlyPoint[] {
  const now = new Date();
  const points: MonthlyPoint[] = [];
  const crossesYear = count > 12;
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = crossesYear
      ? `${MONTH_LABELS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`
      : MONTH_LABELS[d.getMonth()];
    points.push({ key, label, value: map.get(key) ?? 0 });
  }
  return points;
}

/** GrowthBucket[] whose `period` may be "YYYY-MM", "Sep", "2026-09", "Sep 2026"
 *  → a "YYYY-MM" keyed map. Unparseable buckets are dropped. */
function growthToMonthMap(
  buckets: Array<{ period: string; count: number }> | undefined
): Map<string, number> {
  const map = new Map<string, number>();
  (buckets ?? []).forEach(({ period, count }) => {
    const iso = /^(\d{4})-(\d{1,2})/.exec(period);
    if (iso) {
      map.set(`${iso[1]}-${String(Number(iso[2])).padStart(2, '0')}`, count);
      return;
    }
    const named = /([A-Za-z]{3,})[^\d]*(\d{4})?/.exec(period);
    if (named) {
      const monthIdx = MONTH_LABELS.findIndex((m) =>
        named[1].toLowerCase().startsWith(m.toLowerCase())
      );
      if (monthIdx >= 0) {
        const year = named[2] ? Number(named[2]) : new Date().getFullYear();
        map.set(`${year}-${String(monthIdx + 1).padStart(2, '0')}`, count);
      }
    }
  });
  return map;
}

function lastTwo(points: MonthlyPoint[]): Trend {
  if (points.length < 2) {
    return trend(points[points.length - 1]?.value ?? 0, 0);
  }
  return trend(
    points[points.length - 1].value,
    points[points.length - 2].value
  );
}

export function buildChurchOverview(sources: OverviewSources): ChurchOverview {
  const now = new Date();
  const {
    analytics,
    insights,
    formStats,
    memberStats,
    workforceStats,
    givingMonthly,
    approvals,
    newMembers,
    subscribers,
  } = sources;

  const missing: string[] = [];
  const need = (v: unknown, name: string) => {
    if (v === null || v === undefined) missing.push(name);
  };
  need(analytics, 'analytics');
  need(insights, 'decision insights');
  need(formStats, 'form stats');
  need(memberStats, 'member stats');
  need(givingMonthly, 'giving');

  const ops = analytics?.operations;

  // ── People ──────────────────────────────────────────────────────────────
  const totalMembers = memberStats?.total ?? ops?.totalMembers ?? 0;
  const activeMembers = memberStats?.active ?? ops?.activeMembers ?? 0;
  const memberMonthly = lastMonths(
    growthToMonthMap(memberStats?.monthlyGrowth)
  );
  const memberGrowth = lastTwo(memberMonthly);
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const newMembers30d =
    growthToMonthMap(memberStats?.monthlyGrowth).get(thisMonthKey) ??
    newMembers?.thisMonth ??
    0;

  const workforceTotal = workforceStats?.total ?? ops?.totalWorkforce ?? 0;
  const serving =
    workforceStats?.byStatus?.serving ??
    workforceStats?.byStatus?.active ??
    ops?.servingWorkforce ??
    0;

  // ── Intake ──────────────────────────────────────────────────────────────
  const submissionsTotal =
    formStats?.totalSubmissions ?? ops?.totalSubmissions ?? 0;
  const submissions30d = trend(
    insights?.core?.submissionsCurrent30d ?? ops?.submissions30d ?? 0,
    insights?.core?.submissionsPrevious30d ?? 0
  );
  const perForm: FormIntakeItem[] = (formStats?.perForm ?? [])
    .map((f) => ({ formId: f.formId, title: f.formTitle, count: f.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);
  const newMemberIntakeMonthly = lastMonths(
    growthToMonthMap(newMembers?.monthlyGrowth)
  );

  // ── Giving ──────────────────────────────────────────────────────────────
  const givingMap = new Map<string, number>();
  (givingMonthly ?? []).forEach((row) => {
    const key = `${row.year}-${String(row.month).padStart(2, '0')}`;
    givingMap.set(key, (givingMap.get(key) ?? 0) + nairaFromKobo(row.total_kobo));
  });
  const givingPoints = lastMonths(givingMap);
  const lastMonthKey = `${new Date(now.getFullYear(), now.getMonth() - 1, 1).getFullYear()}-${String(new Date(now.getFullYear(), now.getMonth() - 1, 1).getMonth() + 1).padStart(2, '0')}`;
  const givingThisMonth = givingMap.get(thisMonthKey) ?? 0;
  const givingLastMonth = givingMap.get(lastMonthKey) ?? 0;
  const givingYtd = (givingMonthly ?? [])
    .filter((r) => r.year === now.getFullYear())
    .reduce((sum, r) => sum + nairaFromKobo(r.total_kobo), 0);

  // ── Engagement / attention ──────────────────────────────────────────────
  const attention: AttentionItem[] = [];
  const pushAttn = (
    key: string,
    label: string,
    count: number | null | undefined,
    href: string,
    hint: string,
    warnAt = 1
  ) => {
    if (typeof count !== 'number') return;
    attention.push({
      key,
      label,
      count,
      href,
      hint,
      severity: count >= Math.max(warnAt, 10) ? 'critical' : count >= warnAt ? 'warn' : 'info',
    });
  };
  const pendingApprovals = (approvals ?? []).filter(
    (a) => a.status === 'pending'
  ).length;
  pushAttn('approvals', 'Approvals awaiting decision', approvals ? pendingApprovals : null, '/dashboard/super/requests', 'Content or record changes need a super-admin sign-off.');
  pushAttn('prayer', 'Open prayer requests', sources.prayerTotalPending, '/dashboard/prayer-requests', 'Requests still marked pending or being prayed over.', 3);
  pushAttn('contact', 'Contact messages', sources.contactTotal, '/dashboard/contact-messages', 'Enquiries from the website contact form.', 3);
  pushAttn('visits', 'Planned visits to follow up', sources.visitsPending, '/dashboard/visits', 'People who said they are coming and have not been contacted.', 1);

  const attentionSorted = attention.sort((a, b) => {
    const rank = { critical: 0, warn: 1, info: 2 } as const;
    return rank[a.severity] - rank[b.severity] || b.count - a.count;
  });

  // ── Signals ─────────────────────────────────────────────────────────────
  const activationRate =
    insights?.signals?.memberActivationRate ??
    (totalMembers > 0 ? activeMembers / totalMembers : 0);
  const volunteerCoverage =
    insights?.signals?.volunteerCoverageRate ??
    (workforceTotal > 0 ? serving / workforceTotal : 0);
  const submissionDeltaPct =
    insights?.signals?.submissionDeltaPercent ?? submissions30d.deltaPct ?? 0;
  const readinessScore = insights?.signals?.decisionReadinessScore ?? 0;

  // ── Recommendations ─────────────────────────────────────────────────────
  const recommendations: Recommendation[] = [];
  (insights?.recommendations ?? []).forEach((text) => {
    recommendations.push({
      severity: /drop|low|below|risk/i.test(text) ? 'warn' : 'info',
      title: 'Decision engine',
      detail: text,
    });
  });
  if (givingLastMonth > 0 && givingThisMonth < givingLastMonth * 0.7) {
    recommendations.push({
      severity: 'warn',
      title: 'Giving is down this month',
      detail: `₦${givingThisMonth.toLocaleString()} so far vs ₦${givingLastMonth.toLocaleString()} last month. If the month is not over this may be normal — otherwise check payment recording.`,
    });
  }
  attentionSorted
    .filter((a) => a.severity !== 'info')
    .forEach((a) => {
      recommendations.push({
        severity: a.severity === 'critical' ? 'warn' : 'info',
        title: `${a.count} ${a.label.toLowerCase()}`,
        detail: `${a.hint} Clear the backlog in the ${a.label.toLowerCase().includes('approval') ? 'approvals' : 'relevant'} area.`,
      });
    });
  if (submissions30d.deltaPct !== null && submissions30d.deltaPct <= -30) {
    recommendations.push({
      severity: 'warn',
      title: 'Form submissions have slowed',
      detail: `${submissions30d.current} in the last 30 days vs ${submissions30d.previous} the prior 30 (${submissions30d.deltaPct}%). Re-share the active form links or check they still work.`,
    });
  }
  if (volunteerCoverage > 0 && volunteerCoverage < 0.45) {
    recommendations.push({
      severity: 'warn',
      title: 'Volunteer coverage is low',
      detail: `Only ${Math.round(volunteerCoverage * 100)}% of registered workforce are marked as serving. Prioritise workforce follow-up and role assignment.`,
    });
  }
  if (recommendations.length === 0) {
    recommendations.push({
      severity: 'info',
      title: 'Nothing needs attention',
      detail:
        'Growth, giving, backlogs, and volunteer coverage are all within a healthy range.',
    });
  }

  // ── Events (usually empty for this church) ──────────────────────────────
  const eventsMonthly = lastMonths(
    growthToMonthMap(
      (analytics?.monthlyStats ?? []).map((r) => ({
        period: r.month,
        count: r.count,
      }))
    )
  );
  const eventsByCategory: CategoryCount[] = Object.entries(
    analytics?.eventsByCategory ?? {}
  )
    .map(([name, count]) => ({ name, count: Number(count) }))
    .sort((a, b) => b.count - a.count);

  return {
    generatedAt: now.toISOString(),
    missing,
    people: {
      members: {
        total: totalMembers,
        active: activeMembers,
        activationRate,
      },
      memberGrowth,
      newMembers30d,
      workforce: {
        total: workforceTotal,
        serving,
        coverageRate: volunteerCoverage,
      },
      subscribers: {
        total: subscribers?.total ?? 0,
        active: subscribers?.active ?? 0,
        added30d: subscribers?.recentlyAdded30d ?? 0,
      },
      leadership: sources.leadership ?? 0,
    },
    intake: {
      submissionsTotal,
      submissions30d,
      perForm,
      newMemberIntakeMonthly,
    },
    giving: {
      thisMonthNaira: givingThisMonth,
      lastMonthNaira: givingLastMonth,
      ytdNaira: givingYtd,
      trend: trend(givingThisMonth, givingLastMonth),
      monthly: givingPoints,
      hasData: (givingMonthly ?? []).length > 0,
    },
    engagement: {
      attendance30d: trend(
        ops?.attendance30d ?? 0,
        Math.max(0, (ops?.totalAttendance ?? 0) - (ops?.attendance30d ?? 0))
      ),
      attention: attentionSorted,
    },
    ministry: {
      cellGroups: sources.cellGroups ?? 0,
      ministries: sources.ministries ?? 0,
    },
    events: {
      total: analytics?.totalEvents ?? 0,
      upcoming: analytics?.upcomingEvents ?? 0,
      byCategory: eventsByCategory,
      monthly: eventsMonthly,
      hasData: (analytics?.totalEvents ?? 0) > 0,
    },
    signals: {
      readinessScore,
      activationRate,
      volunteerCoverage,
      submissionDeltaPct,
    },
    recommendations,
    monthly: {
      members: memberMonthly,
      giving: givingPoints,
      newMemberIntake: newMemberIntakeMonthly,
    },
  };
}

/* ── Formatting helpers shared by the pages + exports ────────────────────── */

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
