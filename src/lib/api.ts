// src/lib/api.ts
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('token');
    }
    return Promise.reject(error);
  }
);

export const apiClient = {
  async getTestimonials(params?: any) {
    const { data } = await api.get('/testimonials', { params });
    return data;
  },

  async createTestimonial(data: any) {
    const { data: response } = await api.post('/testimonials', data);
    return response;
  },

  async updateTestimonial(id: string, data: any) {
    const { data: response } = await api.put(`/admin/testimonials/${id}`, data);
    return response;
  },

  async deleteTestimonial(id: string) {
    await api.delete(`/admin/testimonials/${id}`);
  },

  async approveTestimonial(id: string) {
    const { data } = await api.patch(`/admin/testimonials/${id}/approve`);
    return data;
  },

  async login(credentials: any) {
    const { data } = await api.post('/auth/login', credentials);
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', data.token);
    }
    return data;
  },

  async logout() {
    await api.post('/auth/logout');
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
    }
  },

  async getCurrentUser() {
    const { data } = await api.get('/auth/me');
    return data;
  },

  async getDashboardStats() {
    const { data } = await api.get('/admin/dashboard');
    return data;
  },

  async getPendingTestimonials(params?: any) {
    const { data } = await api.get('/admin/testimonials/pending', { params });
    return data;
  },

  // Add the missing methods for dashboard
  async getAnalytics() {
    const { data } = await api.get('/admin/analytics');
    return data;
  },

  async getEvents(params?: any) {
    const { data } = await api.get('/events', { params });
    return data;
  },
  
  // Expose the axios instance for custom requests
  api,
};