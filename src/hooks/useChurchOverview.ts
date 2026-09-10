'use client';

import { useCallback, useEffect, useState } from 'react';

import { apiClient } from '@/lib/api';
import {
  buildChurchOverview,
  type ChurchOverview,
  type OverviewSources,
} from '@/lib/analytics/churchOverview';

/* ============================================================================
   useChurchOverview — fetches every super-admin data source (each optional,
   via Promise.allSettled) and reduces them to one `ChurchOverview`. Shared by
   the super Analytics and super Reports pages.
============================================================================ */

function settledValue<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === 'fulfilled' ? result.value : null;
}

export interface UseChurchOverview {
  overview: ChurchOverview | null;
  loading: boolean;
  refreshedAt: Date | null;
  refresh: () => Promise<void>;
}

export function useChurchOverview(): UseChurchOverview {
  const [overview, setOverview] = useState<ChurchOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [
      analytics,
      insights,
      formStats,
      memberStats,
      workforceStats,
      givingMonthly,
      approvals,
      newMembers,
      emailSummary,
      subscribers,
      prayer,
      contact,
      visits,
      cellGroups,
      ministries,
      leadership,
    ] = await Promise.allSettled([
      apiClient.getAnalytics(),
      apiClient.getDecisionInsights(),
      apiClient.getFormStats(),
      apiClient.getMemberStats(),
      apiClient.getWorkforceStats(),
      apiClient.getGivingMonthlySummary(),
      apiClient.listApprovalRequests({ limit: 200 }),
      apiClient.getNewMemberDashboard(),
      apiClient.getEmailMarketingSummary(),
      apiClient.getSubscriberSummary(),
      apiClient.listPrayerRequests({ status: 'pending', limit: 1 }),
      apiClient.listContactMessages({ limit: 1 }),
      apiClient.listVisits({ status: 'new', limit: 1 }),
      apiClient.listCellGroups({ limit: 1 }),
      apiClient.listMinistries({ limit: 1 }),
      apiClient.listLeadership({ limit: 1 }),
    ]);

    const paginatedTotal = (
      r: PromiseSettledResult<{ total?: number } | null>
    ): number | null => {
      const v = settledValue(r);
      return v && typeof v.total === 'number' ? v.total : null;
    };

    const sources: OverviewSources = {
      analytics: settledValue(analytics),
      insights: settledValue(insights),
      formStats: settledValue(formStats),
      memberStats: settledValue(memberStats),
      workforceStats: settledValue(workforceStats),
      givingMonthly: settledValue(givingMonthly),
      approvals: settledValue(approvals),
      newMembers: settledValue(newMembers),
      emailSummary: settledValue(emailSummary),
      subscribers: settledValue(subscribers),
      prayerTotalPending: paginatedTotal(prayer),
      contactTotal: paginatedTotal(contact),
      visitsPending: paginatedTotal(visits),
      cellGroups: paginatedTotal(cellGroups),
      ministries: paginatedTotal(ministries),
      leadership: paginatedTotal(leadership),
    };

    setOverview(buildChurchOverview(sources));
    setRefreshedAt(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { overview, loading, refreshedAt, refresh: load };
}
