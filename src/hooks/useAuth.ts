// src/hooks/useAuth.ts
import { useEffect, useState, useCallback, useRef } from 'react';
import { authService, type AuthState } from '@/lib/auth';
import type { LoginCredentials, LoginResponse } from '@/lib/types/auth';

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>(authService.getState());
  const isMountedRef = useRef(true);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Subscribe to auth state changes
  useEffect(() => {
    isMountedRef.current = true;

    // Subscribe and store unsubscribe function
    unsubscribeRef.current = authService.subscribe((newState: AuthState) => {
      if (isMountedRef.current) {
        setAuthState(newState);
      }
    });

    // Cleanup on unmount
    return () => {
      isMountedRef.current = false;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, []);

  // Login with retry logic
  const login = useCallback(async (
    credentials: LoginCredentials,
    options: { retryCount?: number; retryDelay?: number } = {}
  ): Promise<LoginResponse> => {
    const { retryCount = 1, retryDelay = 1000 } = options;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        return await authService.login(credentials);
      } catch (error: any) {
        lastError = error;
        
        // Don't wait on last attempt
        if (attempt < retryCount) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
        }
      }
    }

    throw lastError || new Error('Login failed after retries');
  }, []);

  // Logout with cleanup - Fixed version
  const logout = useCallback(async (): Promise<void> => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  }, []);

  // Clear any auth errors
  const clearError = useCallback((): void => {
    authService.clearError();
  }, []);

  // Check specific permissions
  const hasPermission = useCallback((permission: string): boolean => {
    if (!authState.admin?.permissions) return false;
    return authState.admin.permissions.includes(permission);
  }, [authState.admin]);

  // Check role
  const hasRole = useCallback((role: string): boolean => {
    return authState.admin?.role === role;
  }, [authState.admin]);

  return {
    // State
    ...authState,
    
    // Actions
    login,
    logout,
    clearError,
    
    // Permission checks
    hasPermission,
    hasRole,
    
    // Convenience getters
    get isAdmin(): boolean {
      return authState.admin?.role === 'admin' || authState.admin?.role === 'super_admin';
    },
    
    get isSuperAdmin(): boolean {
      return authState.admin?.role === 'super_admin';
    },
    
    get isEditor(): boolean {
      return authState.admin?.role === 'editor';
    },
  };
}