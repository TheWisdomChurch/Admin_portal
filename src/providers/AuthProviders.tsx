'use client';

import React, { createContext, useContext, useEffect, useCallback, useRef, useState } from 'react';
import { apiClient, getAuthUser, setAuthUser, clearAuthStorage } from '@/lib/api';
import type { User, MessageResponse } from '@/lib/types';

export type AuthContextType = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  checkAuth: () => Promise<User | null>;
  logout: () => Promise<void>;
  clearData: () => Promise<MessageResponse>;
  updateProfile: (userData: Partial<User>) => Promise<User>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getStatus(e: unknown): number | undefined {
  if (!e || typeof e !== 'object') return undefined;
  const candidate = e as { status?: unknown; response?: { status?: unknown }; cause?: { status?: unknown } };
  const status = candidate.status ?? candidate.response?.status ?? candidate.cause?.status;
  return typeof status === 'number' ? status : undefined;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const initRef = useRef(false);

  const checkAuth = useCallback(async (): Promise<User | null> => {
    try {
      const me = await apiClient.getCurrentUser(); // expects User from extractUser
      setUser(me);

      // store profile only; cookie is the real session
      const remembered = !!localStorage.getItem('wisdomhouse_auth_user');
      setAuthUser(me, remembered);

      return me;
    } catch (e) {
      const status = getStatus(e);
      if (status === 401 || status === 403) {
        clearAuthStorage();
        setUser(null);
        return null;
      }
      // non-auth error: keep existing user state
      return user;
    }
  }, [user]);

  const initializeAuth = useCallback(async () => {
    if (initRef.current) return;
    initRef.current = true;

    setIsLoading(true);
    setError(null);

    // optimistic cache
    const cached = getAuthUser();
    if (cached) setUser(cached);

    try {
      await checkAuth();
    } catch {
      setError('Session check failed. Please refresh.');
    } finally {
      setIsInitialized(true);
      setIsLoading(false);
    }
  }, [checkAuth]);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  const logout = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      await apiClient.logout();
    } finally {
      clearAuthStorage();
      setUser(null);
      setIsLoading(false);
      window.location.href = '/login';
    }
  }, []);

  const clearData = useCallback(async (): Promise<MessageResponse> => {
    const res = await apiClient.clearUserData();
    await checkAuth();
    return res;
  }, [checkAuth]);

  const updateProfile = useCallback(async (userData: Partial<User>): Promise<User> => {
    const updated = await apiClient.updateProfile(userData);
    setUser(updated);

    const remembered = !!localStorage.getItem('wisdomhouse_auth_user');
    setAuthUser(updated, remembered);

    return updated;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        isInitialized,
        error,
        checkAuth,
        logout,
        clearData,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used inside AuthProvider');
  return ctx;
}
