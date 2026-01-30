'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
  useRef,
} from 'react';

import { apiClient, getAuthUser, setAuthUser, clearAuthStorage } from '@/lib/api';
import type { User, LoginCredentials, RegisterData, MessageResponse } from '@/lib/types';

export type AuthContextType = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;       // ✅ required
  isInitialized: boolean;   // ✅ required
  error: string | null;

  login: (credentials: LoginCredentials) => Promise<User>;
  register: (data: RegisterData) => Promise<User>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<User | null>;
  clearData: () => Promise<MessageResponse>;
  updateProfile: (userData: Partial<User>) => Promise<User>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getStatus(e: unknown): number | undefined {
  if (!e || typeof e !== 'object') return undefined;
  const candidate = e as {
    status?: unknown;
    response?: { status?: unknown };
    cause?: { status?: unknown };
  };
  const status = candidate.status ?? candidate.response?.status ?? candidate.cause?.status;
  return typeof status === 'number' ? status : undefined;
}

function unwrapUser(payload: unknown): User {
  if (!payload) throw new Error('Empty response');

  const data = payload as {
    id?: unknown;
    email?: unknown;
    user?: { id?: unknown; email?: unknown };
    data?: { id?: unknown; email?: unknown; user?: { id?: unknown; email?: unknown } };
  };

  if (data.id && data.email) return payload as User;
  if (data.user?.id && data.user?.email) return data.user as User;
  if (data.data?.id && data.data?.email) return data.data as User;
  if (data.data?.user?.id && data.data?.user?.email) return data.data.user as User;

  throw new Error('Unexpected auth payload shape');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const initRef = useRef(false);

  const initializeAuth = useCallback(async () => {
    if (initRef.current) return;
    initRef.current = true;

    setIsLoading(true);
    setError(null);

    const cached = getAuthUser();
    if (cached) setUser(cached);

    try {
      const verifiedRaw = await apiClient.getCurrentUser();
      const verified = unwrapUser(verifiedRaw);

      setUser(verified);

      const remembered = !!localStorage.getItem('wisdomhouse_auth_user');
      setAuthUser(verified, remembered);
    } catch (e) {
      const status = getStatus(e);
      if (status === 401 || status === 403) {
        clearAuthStorage();
        setUser(null);
      } else {
        setError('Session check failed. Please refresh.');
      }
    } finally {
      setIsInitialized(true);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  const login = useCallback(async (credentials: LoginCredentials): Promise<User> => {
    setIsLoading(true);
    setError(null);

    try {
      const loginRaw = await apiClient.login(credentials);

      if ('otp_required' in loginRaw && loginRaw.otp_required) {
        throw new Error('OTP required. Please verify to continue.');
      }

      const u = unwrapUser(loginRaw);
      setUser(u);
      setAuthUser(u, !!credentials.rememberMe);
      return u;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (data: RegisterData): Promise<User> => {
    setIsLoading(true);
    setError(null);

    try {
      const createdRaw = await apiClient.register(data);
      return unwrapUser(createdRaw);
    } finally {
      setIsLoading(false);
    }
  }, []);

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

  const checkAuth = useCallback(async (): Promise<User | null> => {
    try {
      const meRaw = await apiClient.getCurrentUser();
      const me = unwrapUser(meRaw);

      setUser(me);

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
      return user;
    }
  }, [user]);

  const clearData = useCallback(async (): Promise<MessageResponse> => {
    const res = await apiClient.clearUserData();
    await checkAuth();
    return res;
  }, [checkAuth]);

  const updateProfile = useCallback(async (userData: Partial<User>): Promise<User> => {
    const updatedRaw = await apiClient.updateProfile(userData);
    const updated = unwrapUser(updatedRaw);

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
        login,
        register,
        logout,
        checkAuth,
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
