// src/lib/api.ts
import type {
  User,
  LoginCredentials,
  RegisterData,
  ApiResponse,
  MessageResponse,
  PaginatedResponse,
  Testimonial,
  EventData,
  RegisterEventData,
  DashboardAnalytics,
  ReelData,

  // ✅ forms
  AdminForm,
  CreateFormRequest,
  UpdateFormRequest,
  PublicFormPayload,
  SubmitFormRequest,
} from './types';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api/v1';

const AUTH_USER_KEY = 'wisdomhouse_auth_user';

/* ============================================================================
   Error Utilities
============================================================================ */

export interface ApiError extends Error {
  statusCode?: number;
  details?: unknown;
}

export function createApiError(
  message: string,
  statusCode?: number,
  details?: unknown
): ApiError {
  const error = new Error(message) as ApiError;
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

function isApiError(err: unknown): err is ApiError {
  return typeof err === 'object' && err !== null && 'statusCode' in err;
}

/* ============================================================================
   Auth Storage (stores user profile only; cookie holds session)
============================================================================ */

export function getAuthUser(): User | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored =
      localStorage.getItem(AUTH_USER_KEY) ??
      sessionStorage.getItem(AUTH_USER_KEY);

    return stored ? (JSON.parse(stored) as User) : null;
  } catch {
    clearAuthStorage();
    return null;
  }
}

export function setAuthUser(user: User, rememberMe = false): void {
  if (typeof window === 'undefined') return;
  const storage = rememberMe ? localStorage : sessionStorage;
  storage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

export function clearAuthStorage(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(AUTH_USER_KEY);
  sessionStorage.removeItem(AUTH_USER_KEY);
  sessionStorage.removeItem('redirect_after_login');
}

/* ============================================================================
   Fetch Wrappers (cookie-based auth)
============================================================================ */

async function safeParseJson(response: Response): Promise<any | null> {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return null;

  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });

    const json = await safeParseJson(response);
    const payload =
      json ??
      ({ message: await response.text().catch(() => '') } as Record<string, any>);

    if (!response.ok) {
      throw createApiError(
        payload?.error || payload?.message || 'Request failed',
        response.status,
        payload
      );
    }

    return payload as T;
  } catch (err: any) {
    if (isApiError(err)) throw err;
    throw createApiError(err?.message || 'Network error', 0, err);
  }
}

/**
 * Multipart/FormData fetch helper
 * IMPORTANT: Do NOT set Content-Type for FormData; browser will.
 */
async function apiFetchForm<T>(
  endpoint: string,
  formData: FormData,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      method: options.method ?? 'POST',
      body: formData,
      credentials: 'include',
      headers: options.headers, // do not inject content-type
    });

    const json = await safeParseJson(response);
    const payload =
      json ??
      ({ message: await response.text().catch(() => '') } as Record<string, any>);

    if (!response.ok) {
      throw createApiError(
        payload?.error || payload?.message || 'Request failed',
        response.status,
        payload
      );
    }

    return payload as T;
  } catch (err: any) {
    if (isApiError(err)) throw err;
    throw createApiError(err?.message || 'Network error', 0, err);
  }
}

/* ============================================================================
   Response Normalizers
============================================================================ */

function extractUser(response: any): User {
  const data = response?.data;
  if (!data) throw createApiError('Invalid user payload', 400, response);

  if (data.user?.id && data.user?.email) return data.user as User;
  if (data.id && data.email) return data as User;

  throw createApiError('Invalid user payload', 400, response);
}

function unwrapData<T>(res: any, errorMessage: string): T {
  if (res && typeof res === 'object' && 'data' in res) {
    const data = (res as ApiResponse<any>).data;
    if (data === undefined || data === null) throw createApiError(errorMessage, 400, res);
    return data as T;
  }
  return res as T;
}

/* ============================================================================
   Small helpers
============================================================================ */

function toQueryString(params?: Record<string, any>): string {
  if (!params) return '';
  const cleaned: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    cleaned[k] = String(v);
  }
  const qs = new URLSearchParams(cleaned).toString();
  return qs ? `?${qs}` : '';
}

/* ============================================================================
   API CLIENT
============================================================================ */

export const apiClient = {
  /* ===================== AUTH ===================== */

  async login(credentials: LoginCredentials): Promise<User> {
    const res = await apiFetch<ApiResponse<any>>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    return extractUser(res);
  },

  async register(data: RegisterData): Promise<User> {
    const res = await apiFetch<ApiResponse<any>>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return extractUser(res);
  },

  async logout(): Promise<void> {
    await apiFetch('/auth/logout', { method: 'POST' });
  },

  async getCurrentUser(): Promise<User> {
    const res = await apiFetch<ApiResponse<any>>('/auth/me', { method: 'GET' });
    return extractUser(res);
  },

  async updateProfile(userData: Partial<User>): Promise<User> {
    const res = await apiFetch<ApiResponse<any>>('/auth/update-profile', {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
    return extractUser(res);
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<MessageResponse> {
    return apiFetch('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  async clearUserData(): Promise<MessageResponse> {
    return apiFetch('/auth/clear-data', { method: 'POST' });
  },

  async deleteAccount(): Promise<MessageResponse> {
    return apiFetch('/auth/delete-account', { method: 'DELETE' });
  },

  /* ===================== HEALTH ===================== */

  healthCheck() {
    return apiFetch('/health');
  },

  /* ===================== TESTIMONIALS ===================== */

  async getAllTestimonials(params?: { approved?: boolean }): Promise<ApiResponse<Testimonial[]> | Testimonial[]> {
    const qs = params?.approved !== undefined ? `?approved=${params.approved}` : '';
    return apiFetch(`/testimonials${qs}`);
  },

  getPaginatedTestimonials(params?: Record<string, string>): Promise<PaginatedResponse<Testimonial>> {
    const qs = params ? `?${new URLSearchParams(params)}` : '';
    return apiFetch(`/testimonials/paginated${qs}`);
  },

  createTestimonial(data: any) {
    return apiFetch('/testimonials', { method: 'POST', body: JSON.stringify(data) });
  },

  /* ===================== ADMIN ===================== */

  getDashboardStats() {
    return apiFetch('/admin/dashboard');
  },

  updateTestimonial(id: string, data: any) {
    return apiFetch(`/admin/testimonials/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteTestimonial(id: string) {
    return apiFetch(`/admin/testimonials/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  approveTestimonial(id: string) {
    return apiFetch(`/admin/testimonials/${encodeURIComponent(id)}/approve`, { method: 'PATCH' });
  },

  getAllUsers(params?: Record<string, string>) {
    const qs = params ? `?${new URLSearchParams(params)}` : '';
    return apiFetch(`/admin/users${qs}`);
  },

  /* ===================== ANALYTICS ===================== */

  // ✅ now accepts params so your page can pass { range: 'month' }
  async getAnalytics(params?: Record<string, any>): Promise<DashboardAnalytics> {
    const qs = toQueryString(params);
    const res = await apiFetch<ApiResponse<any>>(`/admin/analytics${qs}`, { method: 'GET' });
    return unwrapData<DashboardAnalytics>(res, 'Invalid analytics payload');
  },

  /* ===================== EVENTS ===================== */

  async getEvents(params?: Record<string, any>): Promise<PaginatedResponse<EventData>> {
    const qs = toQueryString(params);
    return apiFetch(`/events${qs}`, { method: 'GET' });
  },

  async getEvent(id: string): Promise<EventData> {
    const res = await apiFetch<ApiResponse<any>>(`/events/${encodeURIComponent(id)}`, { method: 'GET' });
    return unwrapData<EventData>(res, 'Invalid event payload');
  },

  async createEvent(data: RegisterEventData): Promise<EventData> {
    const res = await apiFetch<ApiResponse<any>>('/events', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return unwrapData<EventData>(res, 'Invalid event payload');
  },

  async createEventMultipart(payload: RegisterEventData, image?: File, bannerImage?: File): Promise<EventData> {
    const fd = new FormData();

    Object.entries(payload).forEach(([k, v]) => {
      if (v === undefined || v === null) return;
      if (k === 'tags') fd.append('tags', JSON.stringify(v));
      else fd.append(k, String(v));
    });

    if (image) fd.append('image', image);
    if (bannerImage) fd.append('bannerImage', bannerImage);

    const res = await apiFetchForm<ApiResponse<any>>('/events', fd, { method: 'POST' });
    return unwrapData<EventData>(res, 'Invalid event payload');
  },

  async updateEvent(id: string, data: FormData | Partial<RegisterEventData>): Promise<EventData> {
    if (data instanceof FormData) {
      const res = await apiFetchForm<ApiResponse<any>>(`/events/${encodeURIComponent(id)}`, data, { method: 'PUT' });
      return unwrapData<EventData>(res, 'Invalid event payload');
    }

    const res = await apiFetch<ApiResponse<any>>(`/events/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return unwrapData<EventData>(res, 'Invalid event payload');
  },

  async deleteEvent(id: string): Promise<MessageResponse> {
    return apiFetch(`/events/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  /* ===================== REELS ===================== */

  async getReels(params?: Record<string, any>): Promise<PaginatedResponse<ReelData>> {
    const qs = toQueryString(params);
    const res = await apiFetch<ApiResponse<any>>(`/reels${qs}`, { method: 'GET' });
    return unwrapData<PaginatedResponse<ReelData>>(res, 'Invalid reels payload');
  },

  async createReel(formData: FormData): Promise<ReelData> {
    const res = await apiFetchForm<ApiResponse<any>>('/reels', formData, { method: 'POST' });
    return unwrapData<ReelData>(res, 'Invalid reel payload');
  },

  async deleteReel(id: string): Promise<MessageResponse> {
    return apiFetch(`/reels/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  /* ===================== FORMS (ADMIN) ===================== */

  async getAdminForms(params?: Record<string, any>): Promise<PaginatedResponse<AdminForm>> {
    const qs = toQueryString(params);
    const res = await apiFetch<ApiResponse<any>>(`/admin/forms${qs}`, { method: 'GET' });
    return unwrapData<PaginatedResponse<AdminForm>>(res, 'Invalid forms payload');
  },

  async getAdminForm(id: string): Promise<AdminForm> {
    const res = await apiFetch<ApiResponse<any>>(`/admin/forms/${encodeURIComponent(id)}`, { method: 'GET' });
    return unwrapData<AdminForm>(res, 'Invalid form payload');
  },

  async createAdminForm(payload: CreateFormRequest): Promise<AdminForm> {
    const res = await apiFetch<ApiResponse<any>>('/admin/forms', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return unwrapData<AdminForm>(res, 'Invalid form payload');
  },

  async updateAdminForm(id: string, payload: UpdateFormRequest): Promise<AdminForm> {
    const res = await apiFetch<ApiResponse<any>>(`/admin/forms/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return unwrapData<AdminForm>(res, 'Invalid form payload');
  },

  async deleteAdminForm(id: string): Promise<MessageResponse> {
    return apiFetch(`/admin/forms/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  async publishAdminForm(id: string): Promise<{ slug: string }> {
    const res = await apiFetch<ApiResponse<any>>(`/admin/forms/${encodeURIComponent(id)}/publish`, {
      method: 'POST',
    });
    return unwrapData<{ slug: string }>(res, 'Invalid publish payload');
  },

  /* ===================== FORMS (PUBLIC) ===================== */

  async getPublicForm(slug: string): Promise<PublicFormPayload> {
    const res = await apiFetch<ApiResponse<any>>(`/forms/${encodeURIComponent(slug)}`, { method: 'GET' });
    return unwrapData<PublicFormPayload>(res, 'Invalid public form payload');
  },

  async submitPublicForm(slug: string, payload: SubmitFormRequest): Promise<MessageResponse> {
    return apiFetch(`/forms/${encodeURIComponent(slug)}/submissions`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};

export default apiClient;
