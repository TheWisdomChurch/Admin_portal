// src/providers/AuthProvider.tsx
'use client';

import React, { createContext, useContext, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { AuthState, LoginCredentials, LoginResponse } from '@/lib/types/auth';

interface AuthContextValue extends AuthState {
  login: (credentials: LoginCredentials) => Promise<LoginResponse>;
  logout: () => Promise<void>;
  clearError: () => void;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isEditor: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();

  const value = useMemo(() => ({
    ...auth,
  }), [auth]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Higher Order Component for protected routes
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options: {
    requiredRole?: string;
    requiredPermission?: string;
    redirectTo?: string;
  } = {}
) {
  const WrappedComponent = (props: P) => {
    const auth = useAuthContext();

    if (auth.isLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      );
    }

    if (!auth.isAuthenticated) {
      // In a real app, you would redirect here
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-secondary-900 mb-4">Authentication Required</h2>
            <p className="text-secondary-600">Please login to access this page.</p>
          </div>
        </div>
      );
    }

    if (options.requiredRole && !auth.hasRole(options.requiredRole)) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-secondary-900 mb-4">Access Denied</h2>
            <p className="text-secondary-600">You don't have permission to access this page.</p>
          </div>
        </div>
      );
    }

    if (options.requiredPermission && !auth.hasPermission(options.requiredPermission)) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-secondary-900 mb-4">Access Denied</h2>
            <p className="text-secondary-600">You don't have permission to access this page.</p>
          </div>
        </div>
      );
    }

    return <Component {...props} />;
  };

  WrappedComponent.displayName = `withAuth(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}