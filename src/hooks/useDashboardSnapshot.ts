import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type {
  AdminEmailMarketingSummary,
  DashboardAnalytics,
  DecisionInsights,
  EventData,
  FormStatsResponse,
  MemberStatsResponse,
  NewMemberDashboardResponse,
  StoreOrdersPaginated,
  StoreProductAdmin,
  WorkforceStatsResponse,
  AdminAuditLog,
} from '@/lib/types';

export type AuditLogRecord = AdminAuditLog;

export type DashboardSnapshot = {
  analytics: DashboardAnalytics | null;
  decisionInsights: DecisionInsights | null;
  events: EventData[];
  formStats: FormStatsResponse | null;
  marketing: AdminEmailMarketingSummary | null;
  memberStats: MemberStatsResponse | null;
  newMembers: NewMemberDashboardResponse | null;
  workforceStats: WorkforceStatsResponse | null;
  storeProducts: StoreProductAdmin[];
  storeOrders: StoreOrdersPaginated | null;
  auditLogs: AuditLogRecord[];
  failedSources: string[];
};

async function fetchDashboardSnapshot(): Promise<DashboardSnapshot> {
  const [
    analyticsResult,
    decisionInsightsResult,
    eventsResult,
    formStatsResult,
    marketingResult,
    memberStatsResult,
    newMembersResult,
    workforceStatsResult,
    storeProductsResult,
    storeOrdersResult,
    auditLogsResult,
  ] = await Promise.allSettled([
    apiClient.getAnalytics(),
    apiClient.getDecisionInsights(),
    apiClient.getEvents({ page: 1, limit: 12 }),
    apiClient.getFormStats(),
    apiClient.getEmailMarketingSummary(),
    apiClient.getMemberStats(),
    apiClient.getNewMemberDashboard(),
    apiClient.getWorkforceStats(),
    apiClient.listStoreProductsAdmin(true),
    apiClient.listStoreOrders({ page: 1, limit: 20 }),
    apiClient.listAuditLogs({ page: 1, limit: 50 }),
  ]);

  const results = [
    ['analytics', analyticsResult],
    ['decision insights', decisionInsightsResult],
    ['events', eventsResult],
    ['forms', formStatsResult],
    ['email marketing', marketingResult],
    ['members', memberStatsResult],
    ['new members', newMembersResult],
    ['workforce', workforceStatsResult],
    ['store products', storeProductsResult],
    ['store orders', storeOrdersResult],
    ['audit log', auditLogsResult],
  ] as const;

  return {
    analytics: analyticsResult.status === 'fulfilled' ? analyticsResult.value : null,
    decisionInsights: decisionInsightsResult.status === 'fulfilled' ? decisionInsightsResult.value : null,
    events:
      eventsResult.status === 'fulfilled' && Array.isArray(eventsResult.value.data) ? eventsResult.value.data : [],
    formStats: formStatsResult.status === 'fulfilled' ? formStatsResult.value : null,
    marketing: marketingResult.status === 'fulfilled' ? marketingResult.value : null,
    memberStats: memberStatsResult.status === 'fulfilled' ? memberStatsResult.value : null,
    newMembers: newMembersResult.status === 'fulfilled' ? newMembersResult.value : null,
    workforceStats: workforceStatsResult.status === 'fulfilled' ? workforceStatsResult.value : null,
    storeProducts: storeProductsResult.status === 'fulfilled' ? storeProductsResult.value : [],
    storeOrders: storeOrdersResult.status === 'fulfilled' ? storeOrdersResult.value : null,
    auditLogs: auditLogsResult.status === 'fulfilled' && Array.isArray(auditLogsResult.value) ? auditLogsResult.value : [],
    failedSources: results.filter(([, result]) => result.status === 'rejected').map(([source]) => source),
  };
}

/**
 * Shared data source for the Dashboard Home and Analytics pages — both need
 * overlapping slices of the same operational snapshot, so this is one
 * React Query hook (cached under one key) instead of two separate
 * hand-rolled fetch effects that would double the network calls.
 */
export function useDashboardSnapshot() {
  return useQuery({
    queryKey: ['dashboard', 'snapshot'],
    queryFn: fetchDashboardSnapshot,
  });
}
