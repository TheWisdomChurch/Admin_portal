'use client';

import { RefreshCcw, Calendar } from 'lucide-react';

import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Panel } from '@/ui/Panel';
import { Select } from '@/ui/Select';
import { withAuth } from '@/providers/withAuth';
import { useChurchOverview, type OverviewRange } from '@/hooks/useChurchOverview';
import { RANGE_LABELS } from '@/lib/analytics/churchOverview';
import {
  AttentionPanel,
  ChurchOverviewKpis,
  GivingBreakdown,
  GrowthCharts,
  ReadinessPanel,
} from '@/features/analytics/ChurchOverviewSections';

function SuperAnalyticsPage() {
  const { overview, loading, error, refreshedAt, range, setRange, refresh } =
    useChurchOverview();

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-[28px] border border-[var(--color-border-primary)] bg-[var(--color-text-primary)] p-6 text-[var(--color-text-inverse)] shadow-2xl md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <Badge variant="warning" className="mb-4">Super Admin Intelligence</Badge>
            <h1 className="text-2xl font-bold tracking-tight md:text-4xl">Analytics command center</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-inverse)]/70 md:text-base">
              Church-wide growth, giving, attendance, engagement backlogs, volunteer coverage and decision readiness — every figure measured from the records, from one authority view.
            </p>
            {refreshedAt ? (
              <p className="mt-3 text-xs text-[var(--color-text-inverse)]/50">
                Updated {refreshedAt.toLocaleTimeString()}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={range}
              onChange={(event) => setRange(event.target.value as OverviewRange)}
              className="w-40 border-[var(--color-text-inverse)]/20 bg-transparent text-[var(--color-text-inverse)]"
            >
              <option value="month">This month</option>
              <option value="last30">Last 30 days</option>
              <option value="year">This year</option>
            </Select>
            <Button
              type="button"
              variant="outline"
              onClick={() => void refresh()}
              loading={loading}
              className="border-[var(--color-text-inverse)]/20 text-[var(--color-text-inverse)] hover:bg-[var(--color-text-inverse)]/10"
            >
              <RefreshCcw className="h-4 w-4" />
              <span className="ml-2">Refresh</span>
            </Button>
          </div>
        </div>
      </div>

      {loading && !overview ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Panel key={i}>
              <div className="h-16 animate-pulse rounded-xl bg-[var(--color-background-tertiary)]" />
            </Panel>
          ))}
        </div>
      ) : overview ? (
        <>
          <p className="text-xs text-[var(--color-text-tertiary)]">
            Comparison window: {RANGE_LABELS[overview.range]}
          </p>

          <ChurchOverviewKpis overview={overview} />

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <AttentionPanel overview={overview} />
            <ReadinessPanel overview={overview} />
          </div>

          <GrowthCharts overview={overview} />
          <GivingBreakdown overview={overview} />

          {overview.events.hasData ? (
            <Card title="Events" actions={<Calendar className="h-4 w-4 text-[var(--color-text-tertiary)]" />}>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">Total</p>
                  <p className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]">{overview.events.total}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">Upcoming</p>
                  <p className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]">{overview.events.upcoming}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">Categories</p>
                  <p className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]">{overview.events.byCategory.length}</p>
                </div>
              </div>
            </Card>
          ) : null}
        </>
      ) : (
        <Card title="Analytics unavailable">
          <p className="text-sm text-[var(--color-text-secondary)]">
            {error ??
              'The analytics service did not respond. Check the API connection and refresh.'}
          </p>
        </Card>
      )}
    </div>
  );
}

export default withAuth(SuperAnalyticsPage, { requiredRole: 'super_admin' });
