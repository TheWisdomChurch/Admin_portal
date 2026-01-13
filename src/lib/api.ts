import { Admin, EventData, PaginatedResponse, ReelData } from "./types";

// src/lib/api.ts - Complete fixed version
const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('adminToken', token);
    }
  }

  clearToken() {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('adminToken');
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add Authorization header if token exists
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    // Merge with custom headers if provided
    if (options.headers) {
      Object.assign(headers, options.headers);
    }

    const config: RequestInit = {
      ...options,
      headers,
      credentials: 'include',
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          response.status, 
          errorData.message || errorData.error || 'API request failed'
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(0, 'Network error occurred');
    }
  }

  // Auth endpoints
  async login(credentials: { email: string; password: string }) {
    const response = await this.request<{ 
      token: string; 
      admin: Admin 
    }>('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    this.setToken(response.token);
    return response;
  }

  // Add registration method
  async register(adminData: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    role: 'super_admin' | 'admin';
  }) {
    const response = await this.request<{ 
      token: string; 
      admin: Admin 
    }>('/api/admin/register', {
      method: 'POST',
      body: JSON.stringify(adminData),
    });
    this.setToken(response.token);
    return response;
  }

  async logout() {
    try {
      await this.request('/api/admin/logout', { method: 'POST' });
    } finally {
      this.clearToken();
    }
  }

  async getCurrentAdmin() {
    return this.request<Admin>('/api/admin/me');
  }

  // Event endpoints
  async getEvents(params?: {
    page?: number;
    limit?: number;
    category?: string;
    status?: string;
    search?: string;
  }) {
    const query = new URLSearchParams(params as any).toString();
    return this.request<PaginatedResponse<EventData>>(`/api/events?${query}`);
  }

  async getEvent(id: number) {
    return this.request<EventData>(`/api/events/${id}`);
  }

  async createEvent(data: FormData) {
    // Note: For FormData, we don't set Content-Type header
    // Browser will set it automatically with boundary
    return this.request<EventData>('/api/admin/events', {
      method: 'POST',
      body: data,
    });
  }

  async updateEvent(id: number, data: FormData) {
    return this.request<EventData>(`/api/admin/events/${id}`, {
      method: 'PUT',
      body: data,
    });
  }

  async deleteEvent(id: number) {
    return this.request(`/api/admin/events/${id}`, {
      method: 'DELETE',
    });
  }

  // Reel endpoints
  async getReels(params?: { page?: number; limit?: number }) {
    const query = new URLSearchParams(params as any).toString();
    return this.request<PaginatedResponse<ReelData>>(`/api/reels?${query}`);
  }

  async createReel(data: FormData) {
    return this.request<ReelData>('/api/admin/reels', {
      method: 'POST',
      body: data,
    });
  }

  async deleteReel(id: number) {
    return this.request(`/api/admin/reels/${id}`, {
      method: 'DELETE',
    });
  }

  // Analytics
  async getAnalytics() {
    return this.request<{
      totalEvents: number;
      upcomingEvents: number;
      totalAttendees: number;
      eventsByCategory: Record<string, number>;
      monthlyStats: Array<{ month: string; events: number; attendees: number }>;
    }>('/api/admin/analytics');
  }
}

export const apiClient = new ApiClient();

// Initialize token from localStorage on client side
if (typeof window !== 'undefined') {
  const token = localStorage.getItem('adminToken');
  if (token) {
    apiClient.setToken(token);
  }
}