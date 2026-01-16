// src/providers/AuthProviders.tsx
'use client';
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { apiClient, getAuthToken, getAuthUser, clearAuthStorage } from '@/lib/api';
import { User, LoginCredentials, AuthContextType } from '@/lib/types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Combined routes configuration for clarity
const PUBLIC_ROUTES = ['/', '/login', '/register', '/forgot-password', '/reset-password', '/about', '/contact'];
const AUTH_ROUTES = ['/login', '/register', '/forgot-password', '/reset-password']; // Routes that authenticated users should not access

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // Initialize auth on mount
  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const token = getAuthToken();
      const storedUser = getAuthUser();

      console.log('🔐 [AuthProvider] initializeAuth - Token exists:', !!token);
      console.log('🔐 [AuthProvider] Stored user exists:', !!storedUser);

      if (!token) {
        console.log('🔐 [AuthProvider] No token found');
        setUser(null);
        setIsInitialized(true);
        setIsLoading(false);
        return;
      }

      // Verify with backend first to avoid showing invalid user briefly
      const verifiedUser = await checkAuth();
      if (verifiedUser) {
        setUser(verifiedUser);
      } else {
        setUser(null);
      }

    } catch (err) {
      console.error('❌ [AuthProvider] Initialization error:', err);
      setUser(null);
      setError(err instanceof Error ? err.message : 'Authentication initialization failed');
    } finally {
      setIsInitialized(true);
      setIsLoading(false);
    }
  };

  const checkAuth = useCallback(async (): Promise<User | null> => {
    try {
      setIsLoading(true);
      setError(null);

      const token = getAuthToken();

      if (!token) {
        console.log('🔐 [AuthProvider] checkAuth - No token, skipping');
        setUser(null);
        return null;
      }

      console.log('🔐 [AuthProvider] checkAuth - Fetching current user...');
      const userData = await apiClient.getCurrentUser();
      console.log('✅ [AuthProvider] checkAuth - User data received');

      setUser(userData);
      return userData;
    } catch (err: any) {
      console.error('❌ [AuthProvider] checkAuth failed:', err);

      if (err.statusCode === 401) {
        console.log('🔓 [AuthProvider] Token invalid, clearing storage');
        clearAuthStorage();
      }

      setUser(null);
      setError(err.message || 'Authentication check failed');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Route protection effect
  useEffect(() => {
    if (!isInitialized || isLoading) return;

    const currentPath = pathname || '';
    const isPublic = PUBLIC_ROUTES.some(route => currentPath.startsWith(route));
    const isAuthRoute = AUTH_ROUTES.some(route => currentPath.startsWith(route));

    console.log('🛡️ [AuthProvider] Route protection check:', {
      currentPath,
      isPublic,
      isAuthRoute,
      isAuthenticated: !!user,
      isLoading,
    });

    // Redirect authenticated users from auth routes
    if (user && isAuthRoute) {
      console.log('🛡️ [AuthProvider] Authenticated user accessing auth page, redirecting to home');
      router.replace('/');
      return;
    }

    // Redirect unauthenticated users from protected routes
    if (!user && !isPublic) {
      console.log('🛡️ [AuthProvider] Unauthenticated user accessing protected route, redirecting to login');
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('redirect_after_login', currentPath);
      }
      router.replace('/login');
      return;
    }

    // Admin route protection
    if (user && user.role !== 'admin' && currentPath.startsWith('/admin')) {
      console.log('🛡️ [AuthProvider] Non-admin user accessing admin route, redirecting to home');
      router.replace('/');
      return;
    }
  }, [user, isLoading, isInitialized, pathname, router]);

  const login = async (credentials: LoginCredentials & { rememberMe?: boolean }) => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('🔐 [AuthProvider] Logging in...');
      const response = await apiClient.login(credentials);

      console.log('✅ [AuthProvider] Login successful');

      if (!response.user) {
        throw new Error('Invalid response: User data missing');
      }

      setUser(response.user);

      const redirectPath = typeof window !== 'undefined'
        ? sessionStorage.getItem('redirect_after_login')
        : null;

      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('redirect_after_login');
      }

      // Sanitize redirectPath to prevent open-redirect (ensure internal path)
      const safeRedirect = redirectPath && redirectPath.startsWith('/') && !redirectPath.includes('://') ? redirectPath : '/';
      router.push(safeRedirect);

      return response.user;
    } catch (err: any) {
      console.error('❌ [AuthProvider] Login failed:', err);
      setError(err.message || 'Login failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      setError(null);

      await apiClient.logout();
    } catch (err) {
      console.warn('⚠️ [AuthProvider] Logout API call failed:', err);
    } finally {
      setUser(null);
      clearAuthStorage();
      console.log('✅ [AuthProvider] Logged out');
      router.push('/login');
      setIsLoading(false);
    }
  };

  const clearData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('🧹 [AuthProvider] Clearing user data...');
      const result = await apiClient.clearUserData();
      console.log('✅ [AuthProvider] Data cleared:', result);

      await checkAuth();

      return result;
    } catch (err: any) {
      console.error('❌ [AuthProvider] Clear data failed:', err);
      setError(err.message || 'Failed to clear data');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (userData: Partial<User>) => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('✏️ [AuthProvider] Updating profile...');
      const updatedUser = await apiClient.updateProfile(userData);
      console.log('✅ [AuthProvider] Profile updated');

      setUser(updatedUser);
      return updatedUser;
    } catch (err: any) {
      console.error('❌ [AuthProvider] Update profile failed:', err);
      setError(err.message || 'Failed to update profile');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const value = {
    user,
    isLoading,
    error,
    isAuthenticated: !!user,
    isInitialized,
    login,
    logout,
    checkAuth,
    clearData,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }
  return context;
};

// Enhanced withAuth HOC with actual permission check placeholder implemented
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options?: { requiredRole?: string; requiredPermissions?: string[] }
) {
  return function WithAuthWrapper(props: P) {
    const auth = useAuthContext();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
      if (!auth.isInitialized || auth.isLoading) return;

      if (!auth.isAuthenticated) {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('redirect_after_login', pathname);
        }
        router.replace('/login');
        return;
      }

      if (options?.requiredRole && auth.user?.role !== options.requiredRole) {
        router.replace('/unauthorized');
        return;
      }

      // Implement actual permission check (assuming user has 'permissions' array)
    if (options?.requiredPermissions && auth.user?.permissions) {
  const hasPermission = options.requiredPermissions.every(perm =>
    auth.user?.permissions?.includes(perm) ?? false
  );
  if (!hasPermission) {
    router.replace('/unauthorized');
    return;
  }
}
    }, [auth, router, pathname]);

    if (auth.isLoading || !auth.isInitialized) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      );
    }

    if (!auth.isAuthenticated) {
      return null;
    }

    if (options?.requiredRole && auth.user?.role !== options.requiredRole) {
      return null;
    }

    return <Component {...props} />;
  };
}