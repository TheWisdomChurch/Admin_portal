'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useRef,
  useState,
  useMemo,
} from 'react';
import {
  apiClient,
  getAuthRememberPreference,
  getAuthUser,
  setAuthUser,
  clearAuthStorage,
  isApiError,
} from '@/lib/api';
import type {
  User,
  MessageResponse,
  AuthSecurityProfile,
  LoginCredentials,
  LoginResult,
  LoginChallenge,
  MFAMethod,
  TOTPSetupResponse,
} from '@/lib/types';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export type AccessStatus =
  | 'loading'
  | 'ready'
  | 'login_required'
  | 'mfa_required'
  | 'forbidden';

export type AuthContextType = {
  user: User | null;
  mfaProfile: AuthSecurityProfile | null;

  status: AuthStatus;
  accessStatus: AccessStatus;

  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  bootstrapped: boolean;
  isAdmin: boolean;
  mfaRequired: boolean;
  error: string | null;

  checkAuth: () => Promise<User | null>;
  refreshAuth: () => Promise<void>;

  login: (credentials: LoginCredentials) => Promise<LoginResult>;
  completeLoginOtp: (payload: {
    email: string;
    code: string;
    purpose: string;
    method?: MFAMethod;
    rememberMe?: boolean;
  }) => Promise<User>;
  resendLoginOtp: (payload: { email: string }) => Promise<LoginChallenge>;

  beginTotpSetup: () => Promise<TOTPSetupResponse>;
  enableTotp: (code: string) => Promise<AuthSecurityProfile>;
  disableTotp: (code: string) => Promise<AuthSecurityProfile>;
  setPreferredMfaMethod: (method: MFAMethod) => Promise<AuthSecurityProfile>;

  logout: () => Promise<void>;
  activateSession: () => void;
  clearData: () => Promise<MessageResponse>;
  updateProfile: (userData: Partial<User>) => Promise<User>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ACTIVE_SESSION_KEY = 'wisdom_admin_active_session_marker';
const ACTIVE_TAB_KEY = 'wisdom_admin_active_tab_owner';
const TAB_HEARTBEAT_MS = 4000;
const TAB_STALE_MS = 12000;

function buildSessionMarker(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function buildTabId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

type TabOwnerRecord = {
  id: string;
  ts: number;
};

function readTabOwner(raw: string | null): TabOwnerRecord | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<TabOwnerRecord>;
    if (!parsed || typeof parsed.id !== 'string' || typeof parsed.ts !== 'number') {
      return null;
    }
    return { id: parsed.id, ts: parsed.ts };
  } catch {
    return null;
  }
}

function getStatusCode(e: unknown): number | undefined {
  if (!e || typeof e !== 'object') return undefined;
  const candidate = e as {
    statusCode?: unknown;
    status?: unknown;
    response?: { status?: unknown };
    cause?: { status?: unknown };
  };
  const status =
    candidate.statusCode ??
    candidate.status ??
    candidate.response?.status ??
    candidate.cause?.status;

  return typeof status === 'number' ? status : undefined;
}

function getUserRole(user: User | null): string {
  if (!user) return '';
  const maybeRole = (user as unknown as { role?: unknown }).role;
  return typeof maybeRole === 'string' ? maybeRole.trim().toLowerCase() : '';
}

function getUserPermissions(user: User | null): string[] {
  if (!user) return [];
  const maybePermissions = (user as unknown as { permissions?: unknown }).permissions;
  if (!Array.isArray(maybePermissions)) return [];
  return maybePermissions.filter((item): item is string => typeof item === 'string');
}

function isAdminUser(user: User | null): boolean {
  if (!user) return false;

  const role = getUserRole(user);
  const directAdminFlag = (user as unknown as { isAdmin?: unknown }).isAdmin === true;

  return directAdminFlag || role === 'admin' || role === 'super_admin';
}

function hasAdminAccessPermission(user: User | null): boolean {
  const permissions = getUserPermissions(user).map((p) => p.toLowerCase());

  if (permissions.length === 0) {
    // If your backend does not serialize permissions in /auth/me, do not fail client-side here.
    return true;
  }

  return (
    permissions.includes('admin_access') ||
    permissions.includes('admin:access') ||
    permissions.includes('admin.access') ||
    permissions.includes('permission_admin_access')
  );
}

function isTotpEnabled(profile: AuthSecurityProfile | null): boolean {
  if (!profile || typeof profile !== 'object') return false;

  const record = profile as unknown as Record<string, unknown>;

  if (record.enabled === true) return true;
  if (record.mfaEnabled === true) return true;
  if (record.totpEnabled === true) return true;

  const methods = record.methods;
  if (methods && typeof methods === 'object') {
    const methodRecord = methods as Record<string, unknown>;
    const totp = methodRecord.totp;
    if (totp && typeof totp === 'object') {
      const totpRecord = totp as Record<string, unknown>;
      if (totpRecord.enabled === true || totpRecord.verified === true) {
        return true;
      }
    }
  }

  const preferredMethod = record.preferredMethod;
  if (preferredMethod === 'totp') {
    return true;
  }

  return false;
}

function evaluateAccess(user: User | null, mfaProfile: AuthSecurityProfile | null): AccessStatus {
  if (!user) return 'login_required';

  if (!isAdminUser(user)) {
    return 'forbidden';
  }

  if (!isTotpEnabled(mfaProfile)) {
    return 'mfa_required';
  }

  if (!hasAdminAccessPermission(user)) {
    return 'forbidden';
  }

  return 'ready';
}

function isLoginChallenge(result: LoginResult): result is LoginChallenge {
  return 'otp_required' in result && result.otp_required === true;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [mfaProfile, setMfaProfile] = useState<AuthSecurityProfile | null>(null);

  const [status, setStatus] = useState<AuthStatus>('loading');
  const [accessStatus, setAccessStatus] = useState<AccessStatus>('loading');

  const [isInitialized, setIsInitialized] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const initRef = useRef(false);
  const refreshPromiseRef = useRef<Promise<void> | null>(null);

  const sessionMarkerRef = useRef<string>('');
  const takeoverHandledRef = useRef(false);
  const tabIdRef = useRef<string>(buildTabId());
  const tabHeartbeatRef = useRef<number | null>(null);

  const applyUnauthenticatedState = useCallback(() => {
    setUser(null);
    setMfaProfile(null);
    setStatus('unauthenticated');
    setAccessStatus('login_required');
  }, []);

  const applyAuthenticatedState = useCallback(
    (nextUser: User, nextMfaProfile: AuthSecurityProfile | null) => {
      setUser(nextUser);
      setMfaProfile(nextMfaProfile);
      setStatus('authenticated');
      setAccessStatus(evaluateAccess(nextUser, nextMfaProfile));
    },
    []
  );

  const forceLocalSignout = useCallback((reason = 'session_taken_over') => {
    clearAuthStorage();
    setUser(null);
    setMfaProfile(null);
    setStatus('unauthenticated');
    setAccessStatus('login_required');
    setIsLoading(false);

    if (typeof window !== 'undefined') {
      window.location.href = `/login?reason=${encodeURIComponent(reason)}`;
    }
  }, []);

  const claimTabOwnership = useCallback((force = false) => {
    if (typeof window === 'undefined') return true;

    const now = Date.now();
    const mine = tabIdRef.current;
    const current = readTabOwner(localStorage.getItem(ACTIVE_TAB_KEY));

    if (!current || current.id === mine || force || now - current.ts > TAB_STALE_MS) {
      const next: TabOwnerRecord = { id: mine, ts: now };
      localStorage.setItem(ACTIVE_TAB_KEY, JSON.stringify(next));
      return true;
    }

    return false;
  }, []);

  const checkAuth = useCallback(async (): Promise<User | null> => {
    try {
      const me = await apiClient.getCurrentUser();

      if (!me) {
        clearAuthStorage();
        applyUnauthenticatedState();
        return null;
      }

      setUser(me);

      const remembered = getAuthRememberPreference();
      setAuthUser(me, remembered);

      return me;
    } catch (e) {
      const statusCode = getStatusCode(e);

      if (statusCode === 401 || statusCode === 403) {
        clearAuthStorage();
        applyUnauthenticatedState();
        return null;
      }

      return user;
    }
  }, [applyUnauthenticatedState, user]);

  const refreshAuth = useCallback(async (): Promise<void> => {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const task = (async () => {
      setIsLoading(true);
      setError(null);
      setStatus('loading');
      setAccessStatus('loading');

      try {
        const me = await apiClient.getCurrentUser();

        if (!me) {
          clearAuthStorage();
          applyUnauthenticatedState();
          return;
        }

        setUser(me);
        setAuthUser(me, getAuthRememberPreference());

        try {
          const mfa = await apiClient.getMFASecurityProfile();
          applyAuthenticatedState(me, mfa);
        } catch (e) {
          const statusCode = getStatusCode(e);

          if (statusCode === 401) {
            clearAuthStorage();
            applyUnauthenticatedState();
            return;
          }

          if (statusCode === 403) {
            // Signed in but backend denies auth/mfa/security access details.
            setUser(me);
            setMfaProfile(null);
            setStatus('authenticated');
            setAccessStatus('forbidden');
            return;
          }

          throw e;
        }
      } catch (e) {
        console.error('Auth refresh failed:', e);
        clearAuthStorage();
        applyUnauthenticatedState();
        setError('Session check failed. Please refresh.');
      } finally {
        setIsInitialized(true);
        setBootstrapped(true);
        setIsLoading(false);
        refreshPromiseRef.current = null;
      }
    })();

    refreshPromiseRef.current = task;
    return task;
  }, [applyAuthenticatedState, applyUnauthenticatedState]);

  const initializeAuth = useCallback(async () => {
    if (initRef.current) return;
    initRef.current = true;

    setIsLoading(true);
    setError(null);

    const cached = getAuthUser();
    if (cached) {
      setUser(cached);
    }

    if (typeof window !== 'undefined') {
      sessionMarkerRef.current = localStorage.getItem(ACTIVE_SESSION_KEY) || '';
    }

    try {
      await refreshAuth();

      if (typeof window !== 'undefined' && !sessionMarkerRef.current) {
        const marker = buildSessionMarker();
        sessionMarkerRef.current = marker;
        localStorage.setItem(ACTIVE_SESSION_KEY, marker);
      }
    } catch {
      setError('Session check failed. Please refresh.');
    } finally {
      setIsInitialized(true);
      setBootstrapped(true);
      setIsLoading(false);
    }
  }, [refreshAuth]);

  useEffect(() => {
    void initializeAuth();
  }, [initializeAuth]);

  const login = useCallback(async (credentials: LoginCredentials): Promise<LoginResult> => {
    setError(null);
    setIsLoading(true);

    try {
      const rememberMe = !!credentials.rememberMe;
      const result = await apiClient.login(credentials);

      if (isLoginChallenge(result)) {
        setStatus('unauthenticated');
        setAccessStatus('login_required');
        return result;
      }

      if ('user' in result && result.user) {
        setAuthUser(result.user, rememberMe);
      }

      await refreshAuth();
      return result;
    } finally {
      setIsLoading(false);
    }
  }, [refreshAuth]);

  const completeLoginOtp = useCallback(
    async (payload: {
      email: string;
      code: string;
      purpose: string;
      method?: MFAMethod;
      rememberMe?: boolean;
    }): Promise<User> => {
      setError(null);
      setIsLoading(true);

      try {
        const nextUser = await apiClient.verifyLoginOtp(payload);
        setAuthUser(nextUser, !!payload.rememberMe);
        await refreshAuth();
        return nextUser;
      } finally {
        setIsLoading(false);
      }
    },
    [refreshAuth]
  );

  const resendLoginOtp = useCallback(
    async (payload: { email: string }): Promise<LoginChallenge> => {
      return apiClient.resendLoginOtp(payload);
    },
    []
  );

  const logout = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      await apiClient.logout();
    } finally {
      if (typeof window !== 'undefined') {
        const owner = readTabOwner(localStorage.getItem(ACTIVE_TAB_KEY));
        if (owner?.id === tabIdRef.current) {
          localStorage.removeItem(ACTIVE_TAB_KEY);
        }
      }

      clearAuthStorage();
      applyUnauthenticatedState();
      setIsLoading(false);

      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
  }, [applyUnauthenticatedState]);

  const activateSession = useCallback(() => {
    if (typeof window === 'undefined') return;

    const marker = buildSessionMarker();
    sessionMarkerRef.current = marker;
    localStorage.setItem(ACTIVE_SESSION_KEY, marker);
    claimTabOwnership(true);
  }, [claimTabOwnership]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const onStorage = (event: StorageEvent) => {
      if (event.key === ACTIVE_SESSION_KEY) {
        const next = event.newValue || '';
        const current = sessionMarkerRef.current || '';

        if (!next || !current || next === current) return;
        if (!user || takeoverHandledRef.current) return;

        takeoverHandledRef.current = true;
        forceLocalSignout('session_taken_over');
        return;
      }

      if (event.key === ACTIVE_TAB_KEY) {
        if (!user || takeoverHandledRef.current) return;

        const owner = readTabOwner(event.newValue);
        if (!owner || owner.id === tabIdRef.current) return;

        takeoverHandledRef.current = true;
        forceLocalSignout('another_tab_active');
      }
    };

    const onBeforeUnload = () => {
      const owner = readTabOwner(localStorage.getItem(ACTIVE_TAB_KEY));
      if (owner?.id === tabIdRef.current) {
        localStorage.removeItem(ACTIVE_TAB_KEY);
      }
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [forceLocalSignout, user]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    if (!user) {
      if (tabHeartbeatRef.current) {
        window.clearInterval(tabHeartbeatRef.current);
        tabHeartbeatRef.current = null;
      }
      return undefined;
    }

    if (!claimTabOwnership(false) && !takeoverHandledRef.current) {
      takeoverHandledRef.current = true;
      forceLocalSignout('another_tab_active');
      return undefined;
    }

    tabHeartbeatRef.current = window.setInterval(() => {
      if (takeoverHandledRef.current) return;

      if (!claimTabOwnership(false)) {
        takeoverHandledRef.current = true;
        forceLocalSignout('another_tab_active');
      }
    }, TAB_HEARTBEAT_MS);

    return () => {
      if (tabHeartbeatRef.current) {
        window.clearInterval(tabHeartbeatRef.current);
        tabHeartbeatRef.current = null;
      }
    };
  }, [claimTabOwnership, forceLocalSignout, user]);

  const clearData = useCallback(async (): Promise<MessageResponse> => {
    const res = await apiClient.clearUserData();
    await refreshAuth();
    return res;
  }, [refreshAuth]);

  const updateProfile = useCallback(async (userData: Partial<User>): Promise<User> => {
    const updated = await apiClient.updateProfile(userData);
    setUser(updated);

    const remembered = getAuthRememberPreference();
    setAuthUser(updated, remembered);

    return updated;
  }, []);

  const beginTotpSetup = useCallback(async (): Promise<TOTPSetupResponse> => {
    return apiClient.beginTotpSetup();
  }, []);

  const enableTotp = useCallback(async (code: string): Promise<AuthSecurityProfile> => {
    const profile = await apiClient.enableTotp(code);

    try {
      await apiClient.setPreferredMfaMethod('totp');
    } catch (e) {
      console.warn('Unable to persist preferred MFA method:', e);
    }

    setMfaProfile(profile);
    await refreshAuth();
    return profile;
  }, [refreshAuth]);

  const disableTotp = useCallback(async (code: string): Promise<AuthSecurityProfile> => {
    const profile = await apiClient.disableTotp(code);
    setMfaProfile(profile);
    await refreshAuth();
    return profile;
  }, [refreshAuth]);

  const setPreferredMfaMethod = useCallback(async (method: MFAMethod): Promise<AuthSecurityProfile> => {
    const profile = await apiClient.setPreferredMfaMethod(method);
    setMfaProfile(profile);
    await refreshAuth();
    return profile;
  }, [refreshAuth]);

  const value = useMemo<AuthContextType>(() => {
    const isAuthenticated = status === 'authenticated' && !!user;
    const isAdmin = isAdminUser(user);
    const mfaRequired = accessStatus === 'mfa_required';

    return {
      user,
      mfaProfile,
      status,
      accessStatus,
      isAuthenticated,
      isLoading,
      isInitialized,
      bootstrapped,
      isAdmin,
      mfaRequired,
      error,
      checkAuth,
      refreshAuth,
      login,
      completeLoginOtp,
      resendLoginOtp,
      beginTotpSetup,
      enableTotp,
      disableTotp,
      setPreferredMfaMethod,
      logout,
      activateSession,
      clearData,
      updateProfile,
    };
  }, [
    user,
    mfaProfile,
    status,
    accessStatus,
    isLoading,
    isInitialized,
    bootstrapped,
    error,
    checkAuth,
    refreshAuth,
    login,
    completeLoginOtp,
    resendLoginOtp,
    beginTotpSetup,
    enableTotp,
    disableTotp,
    setPreferredMfaMethod,
    logout,
    activateSession,
    clearData,
    updateProfile,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuthContext must be used inside AuthProvider');
  }
  return ctx;
}