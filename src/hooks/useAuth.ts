// src/hooks/useAuth.ts
import { useState, useEffect, useCallback } from 'react';
import { authService } from '@/lib/auth';
import type { AuthState, LoginCredentials, LoginResponse } from '@/lib/types';

export function useAuth() {
  const [state, setState] = useState<AuthState>(authService.getState());

  useEffect(() => {
    // Subscribe to auth state changes
    const unsubscribe = authService.subscribe(setState);
    
    // Initialize auth on mount
    if (state.isLoading) {
      // Auth service should already be initialized
      // but we can trigger a re-check if needed
    }
    
    return () => {
      unsubscribe();
    };
  }, []);

  const login = useCallback(async (credentials: LoginCredentials): Promise<LoginResponse> => {
    return authService.login(credentials);
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    return authService.logout();
  }, []);

  const clearError = useCallback((): void => {
    authService.clearError();
  }, []);

  return {
    ...state,
    login,
    logout,
    clearError,
  };
}