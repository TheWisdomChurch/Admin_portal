'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  HeartHandshake,
  Info,
  Users,
  Wallet,
} from 'lucide-react';

import { Badge } from '@/ui/Badge';
import { Card } from '@/ui/Card';
import { ChartFrame } from '@/ui/ChartFrame';
import { StatCard, type StatCardTone } from '@/ui/StatCard';
import { getChartPalette } from '@/lib/charts/palette';
import { useTheme } from '@/providers/ThemeProviders';
import {
  formatDeltaPct,
  formatNaira,
  formatPercent,
  RANGE_LABELS,
  type ChurchOverview,
  type MonthlyPoint,
  type Severity,
} from '@/lib/analytics/churchOverview';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
);

function deltaTone(delta: number | null, goodWhenUp = true): StatCardTone {
  if (delta === null || delta === 0) return 'default';
  const up = delta > 0;
  return (up === goodWhenUp ? 'success' : 'warning') as StatCardTone;
}

function lineData(
  points: MonthlyPoint[],
  label: string,
  color: { line: string; fill: string }
) {
  return {
    labels: points.map((p) => p.label),
    datasets: [
      {
        label,
        data: points.map((p) => p.value),
        borderColor: color.line,
        backgroundColor: color.fill,
        fill: true,
        tension: 0.35,
        pointRadius: 2,
      },
    ],
  };
}

const lineOptions = {
  maintainAspectRatio: false,
  responsive: true,
  plugins: { legend: { display: false } },
  scales: {
    y: { beginAtZero: true, ticks: { precision: 0 } },
    x: { grid: { display: false } },
  },
} as const;

const SEVERITY_ICON: Record<Severity, typeof Info> = {
  info: Info,
  warn: AlertTriangle,
  critical: AlertTriangle,
};

const SEVERITY_CLASS: Record<Severity, string> = {
  info: 'text-[var(--color-text-tertiary)]',
  warn: 'text-amber-600',
  critical: 'text-red-600',
};

const hasSeries = (points: MonthlyPoint[]) => points.some((p) => p.value > 0);

export function ChurchOverviewKpis({ overview }: { overview: ChurchOverview }) {
  const { people, intake, giving, engagement } = overview;
  const rangeWord = RANGE_LABELS[overview.range].toLowerCase();
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Members"
        value={people.members.total.toLocaleString()}
        icon={<Users className="h-5 w-5" />}
        trend={`${people.members.active.toLocaleString()} active · ${formatPercent(people.members.activationRate)}`}
      />
      <StatCard
        label={`New members (${rangeWord})`}
        value={people.newMembersInRange.toLocaleString()}
        tone={deltaTone(people.memberGrowth.deltaPct)}
        trend={`${formatDeltaPct(people.memberGrowth.deltaPct)} vs prior month`}
      />
      <StatCard
        label={`Form submissions (${rangeWord})`}
        value={intake.submissions.current.toLocaleString()}
        tone={deltaTone(intake.submissions.deltaPct)}
        trend={`${formatDeltaPct(intake.submissions.deltaPct)} vs prior period · ${intake.submissionsTotal.toLocaleString()} all-time`}
      />
      <StatCard
        label="Giving this month"
        value={giving.hasData ? formatNaira(giving.thisMonthNaira) : '—'}
        icon={<Wallet className="h-5 w-5" />}
        tone={deltaTone(giving.trend.deltaPct)}
        trend={
          giving.hasData
            ? `${formatDeltaPct(giving.trend.deltaPct)} vs last month · ${formatNaira(giving.ytdNaira)} YTD`
            : 'No recorded giving yet'
        }
      />
      <StatCard
        label="Volunteer coverage"
        value={formatPercent(people.workforce.coverageRate)}
        icon={<HeartHandshake className="h-5 w-5" />}
        tone={people.workforce.coverageRate < 0.45 ? 'warning' : 'default'}
        trend={`${people.workforce.serving.toLocaleString()} serving of ${people.workforce.total.toLocaleString()}`}
      />
      <StatCard
        label={`Attendance (${rangeWord})`}
        value={engagement.attendance.current.toLocaleString()}
        tone={deltaTone(engagement.attendance.deltaPct)}
        trend={`${formatDeltaPct(engagement.attendance.deltaPct)} vs prior period`}
      />
      <StatCard
        label="Newsletter subscribers"
        value={people.subscribers.total.toLocaleString()}
        trend={`${people.subscribers.added30d.toLocaleString()} added in 30 days`}
      />
      <StatCard
        label="Leadership profiles"
        value={people.leadership.toLocaleString()}
        trend={`${overview.ministry.ministries} ministries · ${overview.ministry.cellGroups} cell groups`}
      />
    </div>
  );
}

export function AttentionPanel({ overview }: { overview: ChurchOverview }) {
  const items = overview.engagement.attention;
  const nothing = items.every((i) => i.count === 0);
  return (
    <Card title="Needs attention">
      {items.length === 0 || nothing ? (
        <div className="flex items-center gap-3 text-sm text-[var(--color-text-secondary)]">
          <CheckCircle2 className="h-5 w-5 text-[var(--color-success-text)]" />
          Every queue is clear — nothing is waiting on the team.
        </div>
      ) : (
        <ul className="space-y-2.5">
          {items
            .filter((item) => item.count > 0)
            .map((item) => {
              const Icon = SEVERITY_ICON[item.severity];
              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-4 py-3 transition hover:border-[var(--color-border-primary)]"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Icon className={`h-4 w-4 shrink-0 ${SEVERITY_CLASS[item.severity]}`} />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-[var(--color-text-primary)]">
                          {item.label}
                        </span>
                        <span className="block truncate text-xs text-[var(--color-text-tertiary)]">
                          {item.hint}
                        </span>
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <Badge variant={item.severity === 'critical' ? 'danger' : 'warning'}>
                        {item.count}
                      </Badge>
                      <ArrowUpRight className="h-4 w-4 text-[var(--color-text-tertiary)]" />
                    </span>
                  </Link>
                </li>
              );
            })}
        </ul>
      )}
    </Card>
  );
}

export function GrowthCharts({ overview }: { overview: ChurchOverview }) {
  const { resolvedTheme } = useTheme();
  const palette = useMemo(() => getChartPalette(resolvedTheme), [resolvedTheme]);

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <ChartFrame
        title="Member growth"
        subtitle="New members recorded per month."
        hasData={hasSeries(overview.monthly.members)}
        emptyLabel="No members recorded yet"
      >
        <Line
          data={lineData(overview.monthly.members, 'Members', palette.series.blue)}
          options={lineOptions}
        />
      </ChartFrame>

      <ChartFrame
        title="Giving"
        subtitle="Recorded successful giving per month (₦)."
        hasData={overview.giving.hasData}
        emptyLabel="No giving recorded yet"
      >
        <Line
          data={lineData(overview.monthly.giving, 'Giving (₦)', palette.series.emerald)}
          options={lineOptions}
        />
      </ChartFrame>

      <ChartFrame
        title="Attendance"
        subtitle="Service attendance recorded per month."
        hasData={hasSeries(overview.engagement.attendanceMonthly)}
        emptyLabel="No attendance recorded yet"
      >
        <Line
          data={lineData(overview.engagement.attendanceMonthly, 'Attendance', palette.series.violet)}
          options={lineOptions}
        />
      </ChartFrame>

      <ChartFrame
        title="New-member intake"
        subtitle="Membership form submissions per month."
        hasData={hasSeries(overview.monthly.newMemberIntake)}
        emptyLabel="No membership submissions yet"
      >
        <Line
          data={lineData(overview.monthly.newMemberIntake, 'Submissions', palette.series.amber)}
          options={lineOptions}
        />
      </ChartFrame>

      <ChartFrame
        title="Form intake by form"
        subtitle="All-time submissions per public form."
        hasData={overview.intake.perForm.length > 0}
        emptyLabel="No form submissions yet"
        className="xl:col-span-2"
      >
        <Bar
          data={{
            labels: overview.intake.perForm.map((f) => f.title),
            datasets: [
              {
                label: 'Submissions',
                data: overview.intake.perForm.map((f) => f.count),
                backgroundColor: palette.series.amber.line,
                borderRadius: 8,
              },
            ],
          }}
          options={{
            indexAxis: 'y' as const,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { beginAtZero: true, ticks: { precision: 0 } } },
          }}
        />
      </ChartFrame>
    </div>
  );
}

export function GivingBreakdown({ overview }: { overview: ChurchOverview }) {
  const { resolvedTheme } = useTheme();
  const palette = useMemo(() => getChartPalette(resolvedTheme), [resolvedTheme]);
  const { giving } = overview;

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <ChartFrame
        title="Giving by category"
        subtitle="Successful giving, all time (₦)."
        hasData={giving.byCategory.length > 0}
        emptyLabel="No categorised giving yet"
      >
        <Bar
          data={{
            labels: giving.byCategory.map((c) => c.name),
            datasets: [
              {
                label: 'Amount (₦)',
                data: giving.byCategory.map((c) => c.naira),
                backgroundColor: palette.series.emerald.line,
                borderRadius: 8,
              },
            ],
          }}
          options={{
            indexAxis: 'y' as const,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { beginAtZero: true } },
          }}
        />
      </ChartFrame>

      <ChartFrame
        title="Giving by channel"
        subtitle="How gifts came in."
        hasData={giving.byChannel.length > 0}
        emptyLabel="No giving recorded yet"
      >
        <Bar
          data={{
            labels: giving.byChannel.map((c) => c.name),
            datasets: [
              {
                label: 'Amount (₦)',
                data: giving.byChannel.map((c) => c.naira),
                backgroundColor: palette.series.cyan.line,
                borderRadius: 8,
              },
            ],
          }}
          options={{
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } },
          }}
        />
      </ChartFrame>
    </div>
  );
}

export function ReadinessPanel({ overview }: { overview: ChurchOverview }) {
  const score = Math.round(overview.signals.readinessScore);
  const tone =
    score >= 70 ? 'text-[var(--color-success-text)]' : score >= 45 ? 'text-amber-600' : 'text-red-600';
  return (
    <Card title="Decision readiness & recommendations">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="shrink-0 text-center">
          <p className={`text-5xl font-bold tracking-tight ${tone}`}>{score}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">Readiness</p>
          <div className="mt-3 space-y-1 text-left text-xs text-[var(--color-text-tertiary)]">
            <p>Activation {formatPercent(overview.signals.activationRate)}</p>
            <p>Volunteer coverage {formatPercent(overview.signals.volunteerCoverage)}</p>
            <p>Submissions {formatDeltaPct(Math.round(overview.signals.submissionDeltaPct))}</p>
            <p>Giving {formatDeltaPct(Math.round(overview.signals.givingDeltaPct))}</p>
            <p>Attendance {formatDeltaPct(Math.round(overview.signals.attendanceDeltaPct))}</p>
          </div>
        </div>
        <ul className="min-w-0 flex-1 space-y-3">
          {overview.recommendations.map((rec, i) => {
            const Icon = SEVERITY_ICON[rec.severity];
            return (
              <li key={`${rec.title}-${i}`} className="flex gap-3">
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${SEVERITY_CLASS[rec.severity]}`} />
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">{rec.title}</p>
                  <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">{rec.detail}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </Card>
  );
}
