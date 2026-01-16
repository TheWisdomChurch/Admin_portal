// src/lib/api.ts
import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import {
  // Import all types from types.ts
  LoginCredentials,
  RegisterData,
  LoginResponseData,
  AuthResponse,
  User,
  GetCurrentUserResponse,
  PaginatedResponse,
  ApiError,
  EventData,
  ReelData,
  Testimonial,
  CreateTestimonialData,
  DashboardStats,
  ApiResponse,
  RegisterEventData
} from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

// Create axios instance with better configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
  withCredentials: false, // Set to true if using cookies
});

// Request interceptor for adding auth token
api.interceptors.request.use(
  (config) => {
    // Only run in browser environment
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      
      // Add timestamp to prevent caching
      if (config.method?.toLowerCase() === 'get') {
        config.params = {
          ...config.params,
          _t: Date.now(),
        };
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for handling common errors
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError<ApiError>) => {
    // Handle errors globally
    if (typeof window !== 'undefined') {
      // Handle 401 Unauthorized
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        // Only redirect if not on login/register pages
        const currentPath = window.location.pathname;
        if (!currentPath.includes('/login') && !currentPath.includes('/register')) {
          window.location.href = '/login';
        }
      }
      
      // Handle 403 Forbidden
      if (error.response?.status === 403) {
        console.error('Access forbidden. Insufficient permissions.');
      }
      
      // Handle 429 Rate Limit
      if (error.response?.status === 429) {
        console.error('Too many requests. Please try again later.');
      }
    }
    
    // Enhance error object with custom message
    const enhancedError = {
      ...error,
      message: error.response?.data?.message || error.response?.data?.error || error.message,
      statusCode: error.response?.status,
    };
    
    return Promise.reject(enhancedError);
  }
);

// Helper function for handling errors
const handleApiError = (error: any, defaultMessage: string): never => {
  console.error('API Error:', error);
  throw new Error(error.message || defaultMessage);
};

export const apiClient = {
  // ========== AUTHENTICATION ENDPOINTS ==========
  async login(credentials: LoginCredentials): Promise<LoginResponseData> {
    try {
      const { data } = await api.post<AuthResponse>('/auth/login', credentials);
      
      // Store token and user correctly
      if (typeof window !== 'undefined' && data.data?.token) {
        localStorage.setItem('token', data.data.token);
        localStorage.setItem('user', JSON.stringify(data.data.user));
      }
      
      return data.data;
    } catch (error) {
      return handleApiError(error, 'Login failed');
    }
  },

  async register(userData: RegisterData): Promise<LoginResponseData> {
    try {
      const { data } = await api.post<AuthResponse>('/auth/register', userData);
      
      if (typeof window !== 'undefined' && data.data?.token) {
        localStorage.setItem('token', data.data.token);
        localStorage.setItem('user', JSON.stringify(data.data.user));
      }
      
      return data.data;
    } catch (error) {
      return handleApiError(error, 'Registration failed');
    }
  },

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
  },

  async getCurrentUser(): Promise<User> {
    try {
      const { data } = await api.get<GetCurrentUserResponse>('/auth/me');
      return data.data;
    } catch (error) {
      return handleApiError(error, 'Failed to fetch current user');
    }
  },

  // ========== TESTIMONIAL ENDPOINTS ==========
  async getTestimonials(params?: any): Promise<PaginatedResponse<Testimonial>> {
    try {
      const { data } = await api.get<PaginatedResponse<Testimonial>>('/testimonials', { params });
      return data;
    } catch (error) {
      return handleApiError(error, 'Failed to fetch testimonials');
    }
  },

  async createTestimonial(testimonialData: CreateTestimonialData): Promise<Testimonial> {
    try {
      const { data } = await api.post<ApiResponse<Testimonial>>('/testimonials', testimonialData);
      return data.data!;
    } catch (error) {
      return handleApiError(error, 'Failed to create testimonial');
    }
  },

  async updateTestimonial(id: string, testimonialData: Partial<Testimonial>): Promise<Testimonial> {
    try {
      const { data } = await api.put<ApiResponse<Testimonial>>(`/admin/testimonials/${id}`, testimonialData);
      return data.data!;
    } catch (error) {
      return handleApiError(error, 'Failed to update testimonial');
    }
  },

  async deleteTestimonial(id: string): Promise<void> {
    try {
      await api.delete(`/admin/testimonials/${id}`);
    } catch (error) {
      return handleApiError(error, 'Failed to delete testimonial');
    }
  },

  async approveTestimonial(id: string): Promise<Testimonial> {
    try {
      const { data } = await api.patch<ApiResponse<Testimonial>>(`/admin/testimonials/${id}/approve`);
      return data.data!;
    } catch (error) {
      return handleApiError(error, 'Failed to approve testimonial');
    }
  },

  async getPendingTestimonials(params?: any): Promise<PaginatedResponse<Testimonial>> {
    try {
      const { data } = await api.get<PaginatedResponse<Testimonial>>('/admin/testimonials/pending', { params });
      return data;
    } catch (error) {
      return handleApiError(error, 'Failed to fetch pending testimonials');
    }
  },

  // ========== DASHBOARD ENDPOINTS ==========
  async getDashboardStats(): Promise<DashboardStats> {
    try {
      const { data } = await api.get<ApiResponse<DashboardStats>>('/admin/dashboard');
      return data.data!;
    } catch (error) {
      return handleApiError(error, 'Failed to fetch dashboard stats');
    }
  },

  async getAnalytics(): Promise<any> {
    try {
      const { data } = await api.get('/admin/analytics');
      return data;
    } catch (error) {
      return handleApiError(error, 'Failed to fetch analytics');
    }
  },

  // ========== EVENT ENDPOINTS ==========
  async getEvents(params?: any): Promise<PaginatedResponse<EventData>> {
    try {
      const { data } = await api.get<PaginatedResponse<EventData>>('/events', { params });
      return data;
    } catch (error) {
      return handleApiError(error, 'Failed to fetch events');
    }
  },

  async createEvent(eventData: RegisterEventData): Promise<EventData> {
    try {
      const { data } = await api.post<ApiResponse<EventData>>('/admin/events', eventData);
      return data.data!;
    } catch (error) {
      return handleApiError(error, 'Failed to create event');
    }
  },

  async updateEvent(id: string, eventData: Partial<EventData>): Promise<EventData> {
    try {
      const { data } = await api.put<ApiResponse<EventData>>(`/admin/events/${id}`, eventData);
      return data.data!;
    } catch (error) {
      return handleApiError(error, 'Failed to update event');
    }
  },

  async deleteEvent(id: string): Promise<void> {
    try {
      await api.delete(`/admin/events/${id}`);
    } catch (error) {
      return handleApiError(error, 'Failed to delete event');
    }
  },

  // ========== REEL ENDPOINTS ==========
  async getReels(params?: any): Promise<PaginatedResponse<ReelData>> {
    try {
      const { data } = await api.get<PaginatedResponse<ReelData>>('/reels', { params });
      return data;
    } catch (error) {
      return handleApiError(error, 'Failed to fetch reels');
    }
  },

  async createReel(reelData: Partial<ReelData>): Promise<ReelData> {
    try {
      const { data } = await api.post<ApiResponse<ReelData>>('/admin/reels', reelData);
      return data.data!;
    } catch (error) {
      return handleApiError(error, 'Failed to create reel');
    }
  },

  async updateReel(id: string, reelData: Partial<ReelData>): Promise<ReelData> {
    try {
      const { data } = await api.put<ApiResponse<ReelData>>(`/admin/reels/${id}`, reelData);
      return data.data!;
    } catch (error) {
      return handleApiError(error, 'Failed to update reel');
    }
  },

  async deleteReel(id: string): Promise<void> {
    try {
      await api.delete(`/admin/reels/${id}`);
    } catch (error) {
      return handleApiError(error, 'Failed to delete reel');
    }
  },

  // ========== USER/ADMIN MANAGEMENT ENDPOINTS ==========
  async getUsers(params?: any): Promise<PaginatedResponse<User>> {
    try {
      const { data } = await api.get<PaginatedResponse<User>>('/admin/users', { params });
      return data;
    } catch (error) {
      return handleApiError(error, 'Failed to fetch users');
    }
  },

  async getUserById(id: string): Promise<User> {
    try {
      const { data } = await api.get<ApiResponse<User>>(`/admin/users/${id}`);
      return data.data!;
    } catch (error) {
      return handleApiError(error, 'Failed to fetch user');
    }
  },

  async updateUser(id: string, userData: Partial<User>): Promise<User> {
    try {
      const { data } = await api.put<ApiResponse<User>>(`/admin/users/${id}`, userData);
      return data.data!;
    } catch (error) {
      return handleApiError(error, 'Failed to update user');
    }
  },

  async deleteUser(id: string): Promise<void> {
    try {
      await api.delete(`/admin/users/${id}`);
    } catch (error) {
      return handleApiError(error, 'Failed to delete user');
    }
  },

  // ========== FILE UPLOAD ENDPOINT ==========
  async uploadFile(file: File, type: 'image' | 'video' | 'document' = 'image'): Promise<{ url: string }> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);

      const { data } = await api.post<{ url: string }>('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return data;
    } catch (error) {
      return handleApiError(error, 'Failed to upload file');
    }
  },

  // ========== HEALTH CHECK ==========
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    try {
      const { data } = await api.get('/health');
      return data;
    } catch (error) {
      return handleApiError(error, 'Health check failed');
    }
  },

  // ========== UTILITY METHODS ==========
  setAuthToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', token);
    }
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  },

  clearAuthToken(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    delete api.defaults.headers.common['Authorization'];
  },

  getAuthToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('token');
    }
    return null;
  },

  // Expose the axios instance for custom requests
  api,
};