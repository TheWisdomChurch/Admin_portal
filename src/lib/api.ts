import axios, { AxiosError, AxiosResponse } from 'axios';

import { User,
  ApiError,
  MessageResponse,
  LoginCredentials,
  RegisterData,
  ChangePasswordData,
  HealthCheckResponse,
  DashboardAnalytics,
  PaginatedResponse,
  EventData
 } from './types';

const API_BASE_URL = 'http://localhost:8080/api/v1';
const AUTH_USER_KEY = 'wisdomhouse_auth_user';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
  timeout: 15000,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (config.method?.toLowerCase() === 'get') {
    config.params = { ...config.params, _t: Date.now() };
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const response = error.response;
    if (response?.status === 401) {
      clearAuthStorage();
      return Promise.reject(createApiError(error, 'Session expired. Please login again.', 401));
    }
    const message = (response?.data as any)?.message || error.message || 'An error occurred';
    return Promise.reject(createApiError(error, message, response?.status));
  }
);

const createApiError = (error: any, message: string, statusCode?: number): ApiError => {
  const apiError: ApiError = new Error(message) as ApiError;
  apiError.statusCode = statusCode || error.response?.status;
  apiError.originalError = error;
  apiError.response = error.response;
  return apiError;
};

export const setAuthUser = (user: User, rememberMe = false): void => {
  const userString = JSON.stringify(user);
  if (rememberMe) {
    localStorage.setItem(AUTH_USER_KEY, userString);
  } else {
    sessionStorage.setItem(AUTH_USER_KEY, userString);
  }
};

export const getAuthUser = (): User | null => {
  const userString = localStorage.getItem(AUTH_USER_KEY) || sessionStorage.getItem(AUTH_USER_KEY);
  return userString ? JSON.parse(userString) : null;
};

export const clearAuthStorage = (): void => {
  localStorage.removeItem(AUTH_USER_KEY);
  sessionStorage.removeItem(AUTH_USER_KEY);
};

const extractUserData = (response: AxiosResponse): User => {
  const data = response.data;
  if (data?.id && data?.email) return data as User;
  if (data?.data?.id && data?.data?.email) return data.data as User;
  if (data?.user?.id && data?.user?.email) return data.user as User;
  throw new Error('User data not found in response');
};

const handleApiError = (error: any, defaultMessage: string): never => {
  throw error.message ? error : new Error(defaultMessage);
};

// Simulation Layer for Demo Purpose (since no real backend at 8080)
const isMockMode = true;

export const apiClient = {
  async login(credentials: LoginCredentials & { rememberMe?: boolean }): Promise<User> {
    try {
      if (isMockMode) {
        await new Promise(r => setTimeout(r, 800));
        if (credentials.email === 'admin@wisdomchurch.org' && credentials.password === 'password') {
          const user: User = { id: '1', first_name: 'Admin', last_name: 'House', email: credentials.email, role: 'admin' };
          setAuthUser(user, credentials.rememberMe);
          return user;
        }
        throw new Error('Invalid credentials. Use admin@wisdomchurch.org / password');
      }
      const response = await api.post('/auth/login', credentials);
      const user = extractUserData(response);
      setAuthUser(user, credentials.rememberMe);
      return user;
    } catch (error) {
      return handleApiError(error, 'Login failed.');
    }
  },

  async register(userData: RegisterData & { rememberMe?: boolean }): Promise<User> {
    try {
      if (isMockMode) {
        await new Promise(r => setTimeout(r, 800));
        const user: User = { id: Math.random().toString(36).substr(2, 9), ...userData, role: userData.role || 'user' };
        setAuthUser(user, userData.rememberMe);
        return user;
      }
      const response = await api.post('/auth/register', userData);
      const user = extractUserData(response);
      setAuthUser(user, userData.rememberMe);
      return user;
    } catch (error) {
      return handleApiError(error, 'Registration failed.');
    }
  },

  async logout(): Promise<void> {
    try {
      if (!isMockMode) await api.post('/auth/logout');
    } finally {
      clearAuthStorage();
    }
  },

  async getCurrentUser(): Promise<User> {
    try {
      if (isMockMode) {
        const user = getAuthUser();
        if (!user) throw { statusCode: 401, message: 'Unauthorized' };
        return user;
      }
      const response = await api.get('/auth/me');
      const user = extractUserData(response);
      setAuthUser(user, !!localStorage.getItem(AUTH_USER_KEY));
      return user;
    } catch (error: any) {
      if (error.statusCode === 401) clearAuthStorage();
      return handleApiError(error, 'Failed to fetch user.');
    }
  },

  async updateProfile(userData: Partial<User>): Promise<User> {
    try {
      if (isMockMode) {
        const current = getAuthUser();
        if (!current) throw new Error('Not logged in');
        const updated = { ...current, ...userData };
        setAuthUser(updated, !!localStorage.getItem(AUTH_USER_KEY));
        return updated;
      }
      const response = await api.put('/auth/update-profile', userData);
      const user = extractUserData(response);
      setAuthUser(user, !!localStorage.getItem(AUTH_USER_KEY));
      return user;
    } catch (error) {
      return handleApiError(error, 'Update failed.');
    }
  },

  async getAnalytics(): Promise<DashboardAnalytics> {
    if (isMockMode) {
      return {
        totalEvents: 156,
        upcomingEvents: 12,
        totalAttendees: 4500,
        eventsByCategory: { Outreach: 45, Conference: 22, Workshop: 30, Prayer: 59 },
        monthlyStats: []
      };
    }
    const res = await api.get('/analytics');
    return res.data;
  },

  async getEvents(params: any): Promise<PaginatedResponse<EventData>> {
    if (isMockMode) {
      return {
        data: [
          { id: '1', title: 'Sunday Revival', category: 'Revival', date: new Date().toISOString(), status: 'upcoming', attendees: 120, description: '', shortDescription: '', location: '', image: '', tags: [], isFeatured: true, createdAt: '', updatedAt: '', time: '' }
        ],
        total: 1, page: 1, limit: 10, totalPages: 1
      };
    }
    const res = await api.get('/events', { params });
    return res.data;
  },

  async clearUserData(): Promise<MessageResponse> {
    if (isMockMode) return { message: 'Cleared', success: true };
    const res = await api.post('/auth/clear-data');
    return res.data;
  }
};