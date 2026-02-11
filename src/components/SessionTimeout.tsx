'use client';

import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useAuthContext } from '@/providers/AuthProviders';

// Idle logout after N minutes (default 15). Read from env if provided.
const getIdleMs = () => {
  const fromEnv = Number(process.env.NEXT_PUBLIC_SESSION_IDLE_MINUTES);
  const minutes = Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 15;
  return minutes * 60 * 1000;
};

const activityEvents = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll', 'visibilitychange'];

export function SessionTimeout() {
  const { isAuthenticated, isLoading, logout } = useAuthContext();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isLoading || !isAuthenticated) return;

    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        toast.error('You were signed out due to inactivity.');
        await logout();
      }, getIdleMs());
    };

    const handleActivity = () => {
      if (document.visibilityState === 'hidden') return;
      resetTimer();
    };

    resetTimer();
    activityEvents.forEach((event) => window.addEventListener(event, handleActivity, { passive: true }));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      activityEvents.forEach((event) => window.removeEventListener(event, handleActivity));
    };
  }, [isAuthenticated, isLoading, logout]);

  return null;
}
