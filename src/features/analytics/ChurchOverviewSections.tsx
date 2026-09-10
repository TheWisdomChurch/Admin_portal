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
import { Panel } from '@/ui/Panel';
import { StatCard, type StatCardTone } from '@/ui/StatCard';
import { getChartPalette } from '@/lib/charts/palette';
import { useTheme } from '@/providers/ThemeProviders';
import {
  formatDeltaPct,
  formatNaira,
  formatPercent,
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

export function ChurchOverviewKpis({ overview }: { overview: ChurchOverview }) {
  const { people, intake, giving, engagement } = overview;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Members"
        value={people.members.total.toLocaleString()}
        icon={<Users className="h-5 w-5" />}
        trend={`${people.members.active.toLocaleString()} active · ${formatPercent(people.members.activationRate)}`}
      />
      <StatCard
        label="New members this month"
        value={people.newMembers30d.toLocaleString()}
        tone={deltaTone(people.memberGrowth.deltaPct)}
        trend={`${formatDeltaPct(people.memberGrowth.deltaPct)} vs last month`}
      />
      <StatCard
        label="Form submissions (30d)"
        value={intake.submissions30d.current.toLocaleString()}
        tone={deltaTone(intake.submissions30d.deltaPct)}
        trend={`${formatDeltaPct(intake.submissions30d.deltaPct)} vs prior 30 · ${intake.submissionsTotal.toLocaleString()} all-time`}
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
        label="Attendance (30d)"
        value={engagement.attendance30d.current.toLocaleString()}
        trend={`${formatDeltaPct(engagement.attendance30d.deltaPct)} vs earlier`}
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
  const nothing = items.every((i) => i.severity === 'info' && i.count === 0);
  return (
    <Card title="Needs attention">
      {items.length === 0 || nothing ? (
        <div className="flex items-center gap-3 text-sm text-[var(--color-text-secondary)]">
          <CheckCircle2 className="h-5 w-5 text-[var(--color-success-text)]" />
          Every queue is clear — nothing is waiting on the team.
        </div>
      ) : (
        <ul className="space-y-2.5">
          {items.map((item) => {
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
                    <Badge variant={item.count > 0 ? (item.severity === 'critical' ? 'danger' : 'warning') : 'secondary'}>
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
      <Panel>
        <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Member growth</h3>
        <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">New members recorded per month.</p>
        <div className="mt-4 h-[240px]">
          <Line data={lineData(overview.monthly.members, 'Members', palette.series.blue)} options={lineOptions} />
        </div>
      </Panel>
      <Panel>
        <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Giving</h3>
        <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">Recorded successful giving per month (₦).</p>
        <div className="mt-4 h-[240px]">
          {overview.giving.hasData ? (
            <Line data={lineData(overview.monthly.giving, 'Giving (₦)', palette.series.emerald)} options={lineOptions} />
          ) : (
            <p className="grid h-full place-items-center text-sm text-[var(--color-text-tertiary)]">No giving recorded yet.</p>
          )}
        </div>
      </Panel>
      <Panel>
        <h3 className="text-sm font-bold text-[var(--color-text-primary)]">New-member intake</h3>
        <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">Membership form submissions per month.</p>
        <div className="mt-4 h-[240px]">
          <Line data={lineData(overview.monthly.newMemberIntake, 'Submissions', palette.series.amber)} options={lineOptions} />
        </div>
      </Panel>
      <Panel>
        <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Form intake by form</h3>
        <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">All-time submissions per public form.</p>
        <div className="mt-4 h-[240px]">
          {overview.intake.perForm.length > 0 ? (
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
          ) : (
            <p className="grid h-full place-items-center text-sm text-[var(--color-text-tertiary)]">No form submissions yet.</p>
          )}
        </div>
      </Panel>
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
