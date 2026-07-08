import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type {
  AdminEmailMarketingSummary,
  DashboardAnalytics,
  EventData,
  FormStatsResponse,
  MemberStatsResponse,
  NewMemberDashboardResponse,
  StoreOrdersPaginated,
  StoreProductAdmin,
  WorkforceStatsResponse,
} from '@/lib/types';

export type AuditLogRecord = {
  id: string;
  action?: string;
  actor?: string;
  resource?: string;
  description?: string;
  createdAt?: string;
  created_at?: string;
  status?: string;
};

export type DashboardSnapshot = {
  analytics: DashboardAnalytics | null;
  events: EventData[];
  formStats: FormStatsResponse | null;
  marketing: AdminEmailMarketingSummary | null;
  memberStats: MemberStatsResponse | null;
  newMembers: NewMemberDashboardResponse | null;
  workforceStats: WorkforceStatsResponse | null;
  storeProducts: StoreProductAdmin[];
  storeOrders: StoreOrdersPaginated | null;
  auditLogs: AuditLogRecord[];
};

const RAW_API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  ''
).replace(/\/+$/, '');

function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (!RAW_API_BASE) return normalized;

  const baseHasApiV1 = /\/api\/v1$/.test(RAW_API_BASE);
  if (baseHasApiV1 && normalized.startsWith('/api/v1/')) {
    return `${RAW_API_BASE}${normalized.replace('/api/v1', '')}`;
  }

  return `${RAW_API_BASE}${normalized}`;
}

async function optionalGet<T>(path: string): Promise<T | null> {
  if (!RAW_API_BASE) return null;

  try {
    const response = await fetch(apiUrl(path), {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) return null;

    const payload = (await response.json().catch(() => null)) as { data?: T } | T | null;
    if (payload && typeof payload === 'object' && 'data' in payload) {
      return (payload as { data?: T }).data ?? null;
    }
    return payload as T | null;
  } catch {
    return null;
  }
}

async function fetchDashboardSnapshot(): Promise<DashboardSnapshot> {
  const [
    analyticsResult,
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
    apiClient.getEvents({ page: 1, limit: 12 }),
    apiClient.getFormStats(),
    apiClient.getEmailMarketingSummary(),
    apiClient.getMemberStats(),
    apiClient.getNewMemberDashboard(),
    apiClient.getWorkforceStats(),
    apiClient.listStoreProductsAdmin(true),
    apiClient.listStoreOrders({ page: 1, limit: 20 }),
    optionalGet<AuditLogRecord[]>('/api/v1/admin/audit-logs?page=1&limit=50'),
  ]);

  return {
    analytics: analyticsResult.status === 'fulfilled' ? analyticsResult.value : null,
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
