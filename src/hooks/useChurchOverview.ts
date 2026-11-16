'use client';

import { useCallback, useEffect, useState } from 'react';

import { apiClient } from '@/lib/api';
import { mapOverview, type ChurchOverview } from '@/lib/analytics/churchOverview';

/* ============================================================================
   useChurchOverview — one call to GET /admin/analytics/overview, mapped to the
   page view model. The backend computes every figure; this hook does no
   stitching or estimation. `range` drives the current-vs-previous windows.
============================================================================ */

export type OverviewRange = 'month' | 'last30' | 'year';

export interface UseChurchOverview {
  overview: ChurchOverview | null;
  loading: boolean;
  error: string | null;
  refreshedAt: Date | null;
  range: OverviewRange;
  setRange: (range: OverviewRange) => void;
  refresh: () => Promise<void>;
}

export function useChurchOverview(
  initialRange: OverviewRange = 'last30'
): UseChurchOverview {
  const [overview, setOverview] = useState<ChurchOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const [range, setRange] = useState<OverviewRange>(initialRange);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await apiClient.getChurchAnalyticsOverview(range);
      setOverview(mapOverview(resp));
      setRefreshedAt(new Date());
    } catch (err) {
      console.error('church overview load failed:', err);
      setError(
        'The analytics service did not respond. Check the API connection and refresh.'
      );
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const refreshVisiblePage = () => {
      if (document.visibilityState === 'visible') void load();
    };
    const timer = window.setInterval(refreshVisiblePage, 60_000);
    document.addEventListener('visibilitychange', refreshVisiblePage);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshVisiblePage);
    };
  }, [load]);

  return { overview, loading, error, refreshedAt, range, setRange, refresh: load };
}
