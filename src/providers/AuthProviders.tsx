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
import type {
  User,
  LoginCredentials,
  RegisterData,
  AuthContextType,
  MessageResponse,
} from '@/lib/types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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

    // Optional UI cache only
    const cached = getAuthUser();
    if (cached) setUser(cached);

    try {
      // Cookie session is source of truth
      const verified = await apiClient.getCurrentUser();
      setUser(verified);

      const remembered = !!localStorage.getItem('wisdomhouse_auth_user');
      setAuthUser(verified, remembered);
    } catch {
      clearAuthStorage();
      setUser(null);
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
      const userData = await apiClient.login(credentials);
      setUser(userData);
      setAuthUser(userData, !!credentials.rememberMe);
      return userData;
    } catch (e: any) {
      const msg = e?.message || 'Login failed';
      setError(msg);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // IMPORTANT: registration does NOT authenticate
  const register = useCallback(async (data: RegisterData): Promise<User> => {
    setIsLoading(true);
    setError(null);

    try {
      const createdUser = await apiClient.register(data);
      return createdUser;
    } catch (e: any) {
      const msg = e?.message || 'Registration failed';
      setError(msg);
      throw e;
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
      // middleware will handle protection; hard-nav is fine
      window.location.href = '/login';
    }
  }, []);

  const checkAuth = useCallback(async (): Promise<User | null> => {
    try {
      const me = await apiClient.getCurrentUser();
      setUser(me);

      const remembered = !!localStorage.getItem('wisdomhouse_auth_user');
      setAuthUser(me, remembered);

      return me;
    } catch {
      clearAuthStorage();
      setUser(null);
      return null;
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

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used inside AuthProvider');
  return ctx;
}
