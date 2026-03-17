'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api';
import { useAuthContext } from '@/providers/AuthProviders';

const DEFAULT_IDLE_MINUTES = 30;
const MIN_HEARTBEAT_MS = 60 * 1000;
const MAX_HEARTBEAT_MS = 5 * 60 * 1000;

function getStatus(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const candidate = err as { statusCode?: unknown; status?: unknown; response?: { status?: unknown } };
  const status = candidate.statusCode ?? candidate.status ?? candidate.response?.status;
  return typeof status === 'number' ? status : undefined;
}

// Idle logout after N minutes. Match the backend default unless explicitly overridden.
const getIdleMs = () => {
  const fromEnv = Number(process.env.NEXT_PUBLIC_SESSION_IDLE_MINUTES);
  const minutes = Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : DEFAULT_IDLE_MINUTES;
  return minutes * 60 * 1000;
};

function getHeartbeatMs(idleMs: number) {
  return Math.min(Math.max(Math.floor(idleMs / 3), MIN_HEARTBEAT_MS), MAX_HEARTBEAT_MS);
}

const activityEvents = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'] as const;

export function SessionTimeout() {
  const { isAuthenticated, isLoading, logout } = useAuthContext();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastInteractionRef = useRef<number>(Date.now());
  const lastSyncRef = useRef<number>(0);
  const syncInFlightRef = useRef<Promise<void> | null>(null);
  const sessionEndedRef = useRef(false);
  const idleMs = useMemo(() => getIdleMs(), []);
  const heartbeatMs = useMemo(() => getHeartbeatMs(idleMs), [idleMs]);

  const syncServerSession = useCallback(
    async (force = false) => {
      if (typeof window === 'undefined') return;
      if (isLoading || !isAuthenticated || sessionEndedRef.current) return;
      if (!force && document.visibilityState === 'hidden') return;

      const now = Date.now();
      const idleFor = now - lastInteractionRef.current;
      const timeSinceLastSync = now - lastSyncRef.current;

      if (!force && idleFor >= idleMs) return;
      if (!force && timeSinceLastSync < heartbeatMs) return;
      if (syncInFlightRef.current) return syncInFlightRef.current;

      const pending = (async () => {
        try {
          await apiClient.getCurrentUser();
          lastSyncRef.current = Date.now();
        } catch (err) {
          const status = getStatus(err);
          if (status === 401 || status === 403) {
            sessionEndedRef.current = true;
            toast.error('Your session expired. Sign in again to continue.');
            await logout();
          }
        } finally {
          syncInFlightRef.current = null;
        }
      })();

      syncInFlightRef.current = pending;
      return pending;
    },
    [heartbeatMs, idleMs, isAuthenticated, isLoading, logout]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isLoading || !isAuthenticated) return;
    sessionEndedRef.current = false;
    lastInteractionRef.current = Date.now();
    lastSyncRef.current = Date.now();

    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        sessionEndedRef.current = true;
        toast.error('You were signed out due to inactivity.');
        await logout();
      }, idleMs);
    };

    const handleActivity = () => {
      if (document.visibilityState === 'hidden') return;
      lastInteractionRef.current = Date.now();
      resetTimer();
      void syncServerSession();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') return;
      lastInteractionRef.current = Date.now();
      resetTimer();
      void syncServerSession(true);
    };

    const handleFocus = () => {
      lastInteractionRef.current = Date.now();
      resetTimer();
      void syncServerSession(true);
    };

    resetTimer();
    void syncServerSession(true);
    const heartbeat = window.setInterval(() => {
      void syncServerSession();
    }, heartbeatMs);
    activityEvents.forEach((event) => window.addEventListener(event, handleActivity, { passive: true }));
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      window.clearInterval(heartbeat);
      activityEvents.forEach((event) => window.removeEventListener(event, handleActivity));
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [heartbeatMs, idleMs, isAuthenticated, isLoading, logout, syncServerSession]);

  return null;
}
