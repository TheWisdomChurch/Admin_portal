'use client';

import { Activity, BarChart3, RefreshCw } from 'lucide-react';

import { PageHeader } from '@/layouts';
import { useChurchOverview, type OverviewRange } from '@/hooks/useChurchOverview';
import { RANGE_LABELS } from '@/lib/analytics/churchOverview';
import { withAuth } from '@/providers/withAuth';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Panel } from '@/ui/Panel';
import { Select } from '@/ui/Select';
import {
  AttentionPanel,
  ChurchOverviewKpis,
  GivingBreakdown,
  GrowthCharts,
  ReadinessPanel,
} from '@/features/analytics/ChurchOverviewSections';

function AnalyticsPage() {
  const { overview, loading, error, range, setRange, refresh } = useChurchOverview('last30');

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Church health & decision analytics"
        subtitle="Server-calculated church indicators with explicit sources and comparison periods. Windowed KPIs compare equivalent periods; the charts show rolling 12-month trends."
        actions={
          <div className="flex flex-wrap items-end gap-3">
            <Select label="Reporting window" value={range} onChange={(event) => setRange(event.target.value as OverviewRange)}>
              <option value="last30">Last 30 days</option>
              <option value="month">This month</option>
              <option value="year">This year</option>
            </Select>
            <Button variant="outline" onClick={() => void refresh()} loading={loading} icon={<RefreshCw className="h-4 w-4" />}>
              Refresh data
            </Button>
          </div>
        }
      />

      {error && overview ? (
        <Panel className="border-[var(--color-warning-border)] bg-[var(--color-warning-surface)]">
          <p className="text-sm font-semibold text-[var(--color-warning-text)]">Refresh failed. The last successful snapshot is still shown; its timestamp is below.</p>
        </Panel>
      ) : null}

      {overview?.missing.length ? (
        <Panel className="border-[var(--color-warning-border)] bg-[var(--color-warning-surface)]">
          <p className="text-sm font-semibold text-[var(--color-warning-text)]">Some analytics are incomplete. Affected sections: {overview.missing.join(', ')}. Treat those section values as unavailable, not as zero.</p>
        </Panel>
      ) : null}

      {!overview && loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => <Panel key={index}><div className="h-16 animate-pulse rounded-xl bg-[var(--color-background-tertiary)]" /></Panel>)}
        </div>
      ) : overview ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-4 py-3">
            <div className="flex items-center gap-2"><Badge variant="info">{RANGE_LABELS[overview.range]}</Badge><span className="text-xs text-[var(--color-text-secondary)]">Selected period: member records, form intake, and attendance. Giving is shown month to date.</span></div>
            <p className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]"><Activity className="h-3.5 w-3.5" />Snapshot generated {new Date(overview.generatedAt).toLocaleString()}</p>
          </div>

          <ChurchOverviewKpis overview={overview} />

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <AttentionPanel overview={overview} />
            <ReadinessPanel overview={overview} />
          </div>

          <GrowthCharts overview={overview} />
          <GivingBreakdown overview={overview} />

          <div className="grid gap-5 xl:grid-cols-3">
            <Card title="Operational follow-through">
              <div className="space-y-3 text-sm">
                <Metric label="Stalled member journeys" value={overview.intake.workflowStalled} />
                <Metric label="Prayer requests open" value={overview.engagement.attention.find((item) => item.key === 'prayer')?.count ?? 0} />
                <Metric label="Upcoming visits to prepare" value={overview.engagement.attention.find((item) => item.key === 'visits')?.count ?? 0} />
                <Metric label="Pending approvals" value={overview.engagement.attention.find((item) => item.key === 'approvals')?.count ?? 0} />
              </div>
            </Card>
            <Card title="Ministry capacity">
              <div className="space-y-3 text-sm">
                <Metric label="Ministries" value={overview.ministry.ministries} />
                <Metric label="Without assigned workforce" value={overview.ministry.ministriesUnstaffed} />
                <Metric label="Cell groups" value={overview.ministry.cellGroups} />
                <Metric label="Average group size" value={overview.ministry.cellGroupAvgSize.toFixed(1)} />
                <Metric label="Meetings in 30 days" value={overview.ministry.cellGroupMeetings30d} />
              </div>
            </Card>
            <Card title="Service attendance mix" actions={<BarChart3 className="h-4 w-4 text-[var(--color-text-tertiary)]" />}>
              {overview.engagement.attendanceByServiceType.length ? (
                <div className="space-y-3 text-sm">{overview.engagement.attendanceByServiceType.slice(0, 6).map((item) => <Metric key={item.name} label={item.name} value={item.count} />)}</div>
              ) : <p className="text-sm text-[var(--color-text-tertiary)]">No service attendance has been recorded.</p>}
            </Card>
          </div>
        </>
      ) : (
        <Card title="Analytics unavailable"><p className="text-sm text-[var(--color-text-secondary)]">{error ?? 'The analytics service did not respond. Check the API connection and refresh.'}</p></Card>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="flex items-center justify-between gap-4 border-b border-[var(--color-border-secondary)] pb-2 last:border-0 last:pb-0"><span className="text-[var(--color-text-secondary)]">{label}</span><strong className="text-[var(--color-text-primary)]">{value}</strong></div>;
}

export default withAuth(AnalyticsPage, { requiredRole: 'admin' });
