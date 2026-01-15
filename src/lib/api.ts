// src/lib/api.ts
const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || API_BASE_URL;
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('adminToken');
    }
  }

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
    const url = `${this.baseUrl}${endpoint}`;
    
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
    };

    try {
      const response = await fetch(url, config);
      
      // Handle no content responses
      if (response.status === 204) {
        return {} as T;
      }
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          response.status, 
          errorData.message || errorData.error || `API request failed: ${response.statusText}`
        );
      }

      // Parse JSON response
      const text = await response.text();
      return text ? JSON.parse(text) : {} as T;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      if (error instanceof SyntaxError) {
        throw new ApiError(0, 'Invalid JSON response from server');
      }
      throw new ApiError(0, 'Network error occurred');
    }
  }

  // Test connection to Go backend
  async testConnection() {
    return this.request<{ message: string; status: string; version: string }>('/health');
  }

  // Testimonials endpoints (matching your Go backend)
  async getTestimonials(params?: {
    page?: number;
    limit?: number;
    approved?: boolean;
  }) {
    if (params?.page || params?.limit) {
      const query = new URLSearchParams({
        page: params.page?.toString() || '1',
        limit: params.limit?.toString() || '10',
        ...(params.approved !== undefined && { approved: params.approved.toString() })
      }).toString();
      return this.request<{
        testimonials: any[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }>(`/api/v1/testimonials/paginated?${query}`);
    }
    
    return this.request<any[]>('/api/v1/testimonials');
  }

  async getTestimonial(id: string) {
    return this.request<any>(`/api/v1/testimonials/${id}`);
  }

  async createTestimonial(data: {
    name: string;
    email: string;
    testimony: string;
    category?: string;
    approved?: boolean;
  }) {
    return this.request<any>('/api/v1/testimonials', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTestimonial(id: string, data: Partial<{
    name: string;
    email: string;
    testimony: string;
    category: string;
    approved: boolean;
  }>) {
    return this.request<any>(`/api/v1/testimonials/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteTestimonial(id: string) {
    return this.request(`/api/v1/testimonials/${id}`, {
      method: 'DELETE',
    });
  }

  async approveTestimonial(id: string) {
    return this.request<any>(`/api/v1/testimonials/${id}/approve`, {
      method: 'PATCH',
    });
  }

  // Auth endpoints (you'll need to implement these in Go)
  async login(credentials: { email: string; password: string }) {
    // Note: You need to implement this endpoint in your Go backend
    const response = await this.request<{ 
      token: string; 
      user: any;
    }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    if (response.token) {
      this.setToken(response.token);
    }
    return response;
  }

  async register(adminData: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    role: 'super_admin' | 'admin';
  }) {
    return this.request<{ 
      token: string; 
      user: any;
    }>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(adminData),
    });
  }

  async logout() {
    this.clearToken();
    // Optional: Call backend logout endpoint if you implement it
    // await this.request('/api/v1/auth/logout', { method: 'POST' });
  }

  async getCurrentUser() {
    return this.request<any>('/api/v1/auth/me');
  }
}

export const apiClient = new ApiClient();