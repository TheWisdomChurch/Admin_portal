import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { apiClient,  getAuthUser, setAuthUser, clearAuthStorage} from '@/lib/api';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, LoginCredentials, RegisterData, AuthContextType, MessageResponse  } from '@/lib/types';


const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PUBLIC_ROUTES = ['/', '/login', '/register', '/about', '/contact'];
const AUTH_ROUTES = ['/login', '/register'];

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const initializeAuth = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const storedUser = getAuthUser();
      
      try {
        const verifiedUser = await apiClient.getCurrentUser();
        setUser(verifiedUser);
        if (storedUser) {
          const rememberMe = !!localStorage.getItem('wisdomhouse_auth_user');
          setAuthUser(verifiedUser, rememberMe);
        }
      } catch (err: any) {
        if (err.statusCode === 401) clearAuthStorage();
        setUser(null);
      }
    } catch (err) {
      setUser(null);
      setError(err instanceof Error ? err.message : 'Init failed');
    } finally {
      setIsInitialized(true);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  const checkAuth = useCallback(async (): Promise<User | null> => {
    try {
      setIsLoading(true);
      const userData = await apiClient.getCurrentUser();
      setUser(userData);
      return userData;
    } catch (err: any) {
      if (err.statusCode === 401) {
        clearAuthStorage();
        setUser(null);
      }
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isInitialized || isLoading) return;
    const currentPath = location.pathname;
    const isPublic = PUBLIC_ROUTES.some(r => currentPath === r || currentPath.startsWith(r + '/'));
    const isAuthRoute = AUTH_ROUTES.includes(currentPath);

    if (user && isAuthRoute) {
      navigate('/', { replace: true });
      return;
    }

    if (!user && !isPublic) {
      sessionStorage.setItem('redirect_after_login', currentPath);
      navigate('/login', { replace: true });
      return;
    }

    if (user && user.role !== 'admin' && user.role !== 'super_admin' && currentPath.startsWith('/admin')) {
      navigate('/', { replace: true });
      return;
    }
  }, [user, isLoading, isInitialized, location.pathname, navigate]);

  const login = async (credentials: LoginCredentials & { rememberMe?: boolean }): Promise<User> => {
    try {
      setIsLoading(true);
      setError(null);
      const userData = await apiClient.login(credentials);
      setUser(userData);
      const redirectPath = sessionStorage.getItem('redirect_after_login') || '/';
      sessionStorage.removeItem('redirect_after_login');
      navigate(redirectPath);
      return userData;
    } catch (err: any) {
      setError(err.message || 'Login failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterData & { rememberMe?: boolean }): Promise<User> => {
    try {
      setIsLoading(true);
      setError(null);
      const userData = await apiClient.register(data);
      setUser(userData);
      const redirectPath = (userData.role === 'admin' || userData.role === 'super_admin') ? '/admin/dashboard' : '/';
      navigate(redirectPath);
      return userData;
    } catch (err: any) {
      setError(err.message || 'Registration failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      await apiClient.logout();
    } finally {
      setUser(null);
      clearAuthStorage();
      navigate('/login');
      setIsLoading(false);
    }
  };

  const clearData = async (): Promise<MessageResponse> => {
    const res = await apiClient.clearUserData();
    await checkAuth();
    return res;
  };

  const updateProfile = async (userData: Partial<User>): Promise<User> => {
    const updated = await apiClient.updateProfile(userData);
    setUser(updated);
    return updated;
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, error, isAuthenticated: !!user, isInitialized, login, register, logout, checkAuth, clearData, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuthContext must be used within AuthProvider');
  return context;
};

export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options?: { requiredRole?: string }
) {
  return function WithAuthWrapper(props: P) {
    const { isAuthenticated, user, isLoading, isInitialized } = useAuthContext();
    const navigate = useNavigate();

    useEffect(() => {
      if (!isInitialized || isLoading) return;
      if (!isAuthenticated) {
        navigate('/login');
      } else if (options?.requiredRole && user?.role !== options.requiredRole) {
        navigate('/');
      }
    }, [isAuthenticated, user, isLoading, isInitialized, navigate]);

    if (!isInitialized || isLoading) return <div className="h-screen flex items-center justify-center"><i className="fas fa-circle-notch fa-spin text-indigo-600 text-4xl"></i></div>;
    if (!isAuthenticated) return null;
    return <Component {...props} />;
  };
}
