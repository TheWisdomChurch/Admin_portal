// src/lib/api.ts
import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import {
  LoginCredentials,
  RegisterData,
  LoginResponseData,
  User,
  PaginatedResponse,
  ApiError,
  EventData,
  ReelData,
  Testimonial,
  CreateTestimonialData,
  DashboardStats,
  ApiResponse,
  RegisterEventData,
  ChangePasswordData,
  MessageResponse,
  UploadResponse,
  HealthCheckResponse,
} from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
  timeout: 15000,
  withCredentials: false, // Flip to true if using cookies for auth in production
});

api.interceptors.request.use(
  (config) => {
    if (typeof window === 'undefined') {
      return config;
    }

    const token = getAuthToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Optional cache-buster for GET requests
    if (config.method?.toLowerCase() === 'get' && config.params?._cacheBust !== false) {
      config.params = {
        ...config.params,
        _t: Date.now(),
      };
    }

    return config;
  },
  (error) => {
    console.error('❌ [API Request Error]', error);
    return Promise.reject(createApiError(error, 'Request failed'));
  }
);

const hasMessage = (obj: any): obj is { message: string } => {
  return obj && typeof obj === 'object' && 'message' in obj;
};

api.interceptors.response.use(
  (response: AxiosResponse) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ [${response.status}] ${response.config.url}`);
    }

    const data = response.data;
    if (data && typeof data === 'object' && 'data' in data) {
      response.data = (data as any).data;
    }

    return response;
  },
  (error: AxiosError) => {
    const config = error.config;
    const response = error.response;

    console.error('❌ [API Error]', {
      url: config?.url,
      method: config?.method,
      status: response?.status,
      data: response?.data,
    });

    if (response?.status === 401) {
      console.log('🔓 [API] Token invalid or expired');
      clearAuthStorage();
      const errorMessage = hasMessage(response.data)
        ? response.data.message
        : 'Session expired. Please login again.';
      return Promise.reject(createApiError(error, errorMessage, 401));
    }

    if (response?.status === 403) {
      const errorMessage = hasMessage(response.data)
        ? response.data.message
        : 'You do not have permission to perform this action.';
      return Promise.reject(createApiError(error, errorMessage, 403));
    }

    if (!response) {
      return Promise.reject(createApiError(error, 'Network error. Please check your connection.'));
    }

    if (response?.status === 400) {
      const errorMessage = hasMessage(response.data)
        ? response.data.message
        : 'Invalid request. Please check your input.';
      return Promise.reject(createApiError(error, errorMessage, 400));
    }

    if (response?.status >= 500) {
      const errorMessage = hasMessage(response.data)
        ? response.data.message
        : 'Server error. Please try again later.';
      return Promise.reject(createApiError(error, errorMessage, response.status));
    }

    let errorMessage = error.message || 'An error occurred';
    if (response?.data) {
      if (hasMessage(response.data)) {
        errorMessage = response.data.message;
      } else if (typeof response.data === 'string') {
        errorMessage = response.data;
      } else if (typeof response.data === 'object' && 'error' in response.data && typeof response.data.error === 'string') {
        errorMessage = response.data.error;
      }
    }

    return Promise.reject(createApiError(error, errorMessage, response?.status));
  }
);

const createApiError = (error: any, message: string, statusCode?: number): ApiError => {
  const apiError: ApiError = new Error(message) as ApiError;
  apiError.statusCode = statusCode || error.response?.status;
  apiError.originalError = error;
  apiError.response = error.response;
  return apiError;
};

const handleApiError = (error: any, defaultMessage: string): never => {
  console.error('🔥 [API Error Handler]', {
    message: error.message,
    defaultMessage,
    statusCode: error.statusCode,
  });

  throw error.message ? error : new Error(defaultMessage);
};

const AUTH_TOKEN_KEY = 'wisdomhouse_auth_token';
const AUTH_USER_KEY = 'wisdomhouse_auth_user';

export const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;

  try {
    return localStorage.getItem(AUTH_TOKEN_KEY) || sessionStorage.getItem(AUTH_TOKEN_KEY);
  } catch (error) {
    console.warn('⚠️ Failed to get auth token:', error);
    return null;
  }
};

export const setAuthToken = (token: string, rememberMe = false): void => {
  if (typeof window === 'undefined') return;

  try {
    if (rememberMe) {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      sessionStorage.setItem(AUTH_TOKEN_KEY, token);
    }
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } catch (error) {
    console.warn('⚠️ Failed to set auth token:', error);
  }
};

export const setAuthUser = (user: User, rememberMe = false): void => {
  if (typeof window === 'undefined') return;

  try {
    const userString = JSON.stringify(user);
    if (rememberMe) {
      localStorage.setItem(AUTH_USER_KEY, userString);
    } else {
      sessionStorage.setItem(AUTH_USER_KEY, userString);
    }
  } catch (error) {
    console.warn('⚠️ Failed to set auth user:', error);
  }
};

export const getAuthUser = (): User | null => {
  if (typeof window === 'undefined') return null;

  try {
    const userString = localStorage.getItem(AUTH_USER_KEY) || sessionStorage.getItem(AUTH_USER_KEY);
    return userString ? JSON.parse(userString) : null;
  } catch (error) {
    console.warn('⚠️ Failed to get auth user:', error);
    return null;
  }
};

export const clearAuthStorage = (): void => {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    sessionStorage.removeItem(AUTH_USER_KEY);
    delete api.defaults.headers.common['Authorization'];
  } catch (error) {
    console.warn('⚠️ Failed to clear auth storage:', error);
  }
};

const hasKey = <K extends string>(obj: any, key: K): obj is Record<K, any> => {
  return obj && typeof obj === 'object' && key in obj;
};

const extractData = <T>(response: AxiosResponse): T => {
  const data = response.data;

  if (data && typeof data === 'object') {
    if (hasKey(data, 'data') && data.data !== undefined) {
      return data.data as T;
    }

    const possibleKeys = ['user', 'event', 'reel', 'testimonial', 'stats', 'message'];
    for (const key of possibleKeys) {
      if (hasKey(data, key)) {
        return data[key] as T;
      }
    }
  }

  return data as T;
};

export const apiClient = {
  async login(credentials: LoginCredentials & { rememberMe?: boolean }): Promise<LoginResponseData> {
    try {
      console.log('🔐 [Login] Attempting login');

      const response = await api.post('/auth/login', {
        email: credentials.email.trim(),
        password: credentials.password,
      });

      console.log('✅ [Login] Response received');

      const data = extractData<LoginResponseData>(response);

      if (data.token && data.user) {
        setAuthToken(data.token, credentials.rememberMe || false);
        setAuthUser(data.user, credentials.rememberMe || false);
      }

      return data;
    } catch (error) {
      return handleApiError(error, 'Login failed. Please check your credentials.');
    }
  },

  async register(userData: RegisterData & { rememberMe?: boolean }): Promise<LoginResponseData> {
    try {
      console.log('📝 [Register] Attempting registration');

      const response = await api.post('/auth/register', {
        firstName: userData.first_name.trim(),
        lastName: userData.last_name.trim(),
        email: userData.email.trim().toLowerCase(),
        password: userData.password,
        role: userData.role || 'user',
      });

      const data = extractData<LoginResponseData>(response);

      if (data.token && data.user) {
        setAuthToken(data.token, userData.rememberMe || false);
        setAuthUser(data.user, userData.rememberMe || false);
      }

      return data;
    } catch (error) {
      return handleApiError(error, 'Registration failed. Please try again.');
    }
  },

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.warn('⚠️ [Logout] Backend logout failed:', error);
    } finally {
      clearAuthStorage();
    }
  },

  async getCurrentUser(): Promise<User> {
    try {
      console.log('👤 [getCurrentUser] Fetching current user');

      const token = getAuthToken();
      if (!token) {
        throw createApiError({}, 'No authentication token found', 401);
      }

      const response = await api.get('/auth/me');
      console.log('✅ [getCurrentUser] Response received');

      const userData = extractData<User>(response);

      const currentUser = getAuthUser();
      if (currentUser) {
        const mergedUser = { ...currentUser, ...userData };
        setAuthUser(mergedUser, !!localStorage.getItem(AUTH_USER_KEY));
      }

      return userData;
    } catch (error) {
      if ((error as ApiError).statusCode === 401) {
        clearAuthStorage();
      }
      return handleApiError(error, 'Failed to fetch user profile.');
    }
  },

  async updateProfile(userData: Partial<User>): Promise<User> {
    try {
      console.log('✏️ [updateProfile] Updating profile');

      const response = await api.put('/auth/update-profile', userData);
      const updatedUser = extractData<User>(response);

      const currentUser = getAuthUser();
      if (currentUser) {
        const mergedUser = { ...currentUser, ...updatedUser };
        setAuthUser(mergedUser, !!localStorage.getItem(AUTH_USER_KEY));
      }

      return updatedUser;
    } catch (error) {
      return handleApiError(error, 'Failed to update profile.');
    }
  },

  async changePassword(passwordData: ChangePasswordData): Promise<MessageResponse> {
    try {
      console.log('🔑 [changePassword] Changing password');

      const response = await api.post('/auth/change-password', passwordData);
      const result = extractData<MessageResponse>(response);

      return result;
    } catch (error) {
      return handleApiError(error, 'Failed to change password.');
    }
  },

  async deleteAccount(): Promise<MessageResponse> {
    try {
      console.log('🗑️ [deleteAccount] Deleting account');

      const response = await api.delete('/auth/delete-account');
      const result = extractData<MessageResponse>(response);

      clearAuthStorage();

      return result;
    } catch (error) {
      return handleApiError(error, 'Failed to delete account.');
    }
  },

  async clearUserData(): Promise<MessageResponse> {
    try {
      console.log('🧹 [clearUserData] Clearing user data');

      const response = await api.post('/auth/clear-data');
      const result = extractData<MessageResponse>(response);

      return result;
    } catch (error) {
      return handleApiError(error, 'Failed to clear user data.');
    }
  },

  // Placeholder for other methods (events, testimonials, etc.) - implement as needed
  // e.g., async getEvents(): Promise<PaginatedResponse<EventData>> { ... }

  getAuthToken,
  setAuthToken,
  getAuthUser,
  clearAuthStorage,

  async healthCheck(): Promise<HealthCheckResponse> {
    try {
      const { data } = await api.get('/health');
      return data;
    } catch (error) {
      return handleApiError(error, 'Health check failed');
    }
  },

  api, // Expose for custom requests
};