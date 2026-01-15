// src/providers/AuthProvider.tsx (updated withAuth for redirects)
'use client';

import React, { createContext, useContext, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { AuthState, LoginCredentials, LoginResponse } from '@/lib/types';

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

  const value = useMemo((): AuthContextValue => ({
    ...auth,
    hasPermission: (permission: string) => {
      // Stub implementation since 'permissions' is not in Admin type
      // Update based on your requirements, e.g., always true for admins or role-based
      // For now, return true if authenticated; adjust as needed
      return auth.isAuthenticated;
    },
    hasRole: (role: string) => {
      // Since 'role' is a string, use equality check instead of includes
      return auth.admin?.role === role;
    },
    isAdmin: auth.admin?.role === 'admin',
    isSuperAdmin: auth.admin?.role === 'super_admin',
    isEditor: false, // Stub: No 'editor' role in types; adjust if added
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
    const router = useRouter();
    const redirectTo = options.redirectTo || '/login';

    useEffect(() => {
      if (!auth.isLoading) {
        if (!auth.isAuthenticated) {
          router.push(redirectTo);
        } else if (options.requiredRole && !auth.hasRole(options.requiredRole)) {
          router.push(redirectTo);
        } else if (options.requiredPermission && !auth.hasPermission(options.requiredPermission)) {
          router.push(redirectTo);
        }
      }
    }, [auth.isLoading, auth.isAuthenticated, auth.hasRole, auth.hasPermission, router, redirectTo, options.requiredRole, options.requiredPermission]);

    if (auth.isLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      );
    }

    // If checks fail, return null while redirecting
    if (!auth.isAuthenticated ||
        (options.requiredRole && !auth.hasRole(options.requiredRole)) ||
        (options.requiredPermission && !auth.hasPermission(options.requiredPermission))) {
      return null;
    }

    return <Component {...props} />;
  };

  WrappedComponent.displayName = `withAuth(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}