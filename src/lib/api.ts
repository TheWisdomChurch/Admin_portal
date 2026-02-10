import type {
  User,
  LoginCredentials,
  RegisterData,
  ApiResponse,
  MessageResponse,
  PaginatedResponse,
  SimplePaginatedResponse,
  Testimonial,
  CreateTestimonialData,
  UpdateTestimonialData,
  EventData,
  EventPayload,
  DashboardAnalytics,
  ReelData,
  CreateReelData,
  AdminForm,
  CreateFormRequest,
  UpdateFormRequest,
  PublicFormPayload,
  SubmitFormRequest,
  FormSubmission,
  FormStatsResponse,
  FormStatus,
  FormSubmissionDailyStat,
  Subscriber,
  SubscribeRequest,
  UnsubscribeRequest,
  SendNotificationRequest,
  SendNotificationResult,
  SendOTPRequest,
  VerifyOTPRequest,
  SendOTPResponse,
  VerifyOTPResponse,
  WorkforceMember,
  CreateWorkforceRequest,
  UpdateWorkforceRequest,
  WorkforceStatsResponse,
  PasswordResetRequestPayload,
  PasswordResetConfirmPayload,
  LoginResult,
  LoginChallenge,
  ChangePasswordData,
  HealthCheckResponse,
  UploadPresignRequest,
  UploadPresignResponse,
} from './types';

/* ============================================================================
   API CLIENT CONFIG
============================================================================ */

/**
 * Normalize an origin string:
 * - trims
 * - removes trailing slashes
 * - strips a trailing /api/v1 if someone passes that
 *
 * In development, falls back to localhost.
 * In production, requires an explicit env var (fails loudly if missing).
 */
function normalizeOrigin(raw?: string | null): string {
  const nodeEnv = process.env.NODE_ENV;
  const isProd = nodeEnv === 'production';

  if (!raw || !raw.trim()) {
    if (!isProd) return 'http://localhost:8080';
    throw new Error('[api] Missing NEXT_PUBLIC_API_URL (or NEXT_PUBLIC_BACKEND_URL) in production.');
  }

  let base = raw.trim().replace(/\/+$/, '');
  if (base.endsWith('/api/v1')) base = base.slice(0, -'/api/v1'.length);
  return base;
}

// IMPORTANT: for admin portal, always use same-origin proxy when enabled
const USE_API_PROXY = process.env.NEXT_PUBLIC_API_PROXY === 'true';

// Origin only used for rootFetch health in prod and for non-proxy mode
const API_ORIGIN = normalizeOrigin(
  process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL
);

// When proxy is enabled, all API calls go to same-origin:
const API_V1_BASE_URL = USE_API_PROXY ? '/api/v1' : `${API_ORIGIN}/api/v1`;

// Uploads: route through same proxy too if you want cookies/session consistently
const UPLOAD_ORIGIN = normalizeOrigin(
  process.env.NEXT_PUBLIC_UPLOAD_BASE_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.NEXT_PUBLIC_BACKEND_URL
);

const UPLOAD_V1_BASE_URL = USE_API_PROXY ? '/api/v1' : `${UPLOAD_ORIGIN}/api/v1`;

const AUTH_USER_KEY = 'wisdomhouse_auth_user';

/* ============================================================================
   Error Utilities (WITH validationErrors)
============================================================================ */

export type ValidationFieldError = {
  field: string;
  code?: string;
  message: string;
};

export interface ApiError extends Error {
  statusCode?: number;
  details?: unknown;
  validationErrors?: ValidationFieldError[];
}

export function createApiError(
  message: string,
  statusCode?: number,
  details?: unknown,
  validationErrors?: ValidationFieldError[]
): ApiError {
  const error = new Error(message) as ApiError;
  error.statusCode = statusCode;
  error.details = details;
  if (validationErrors && validationErrors.length > 0) {
    error.validationErrors = validationErrors;
  }
  return error;
}

export function isApiError(err: unknown): err is ApiError {
  return typeof err === 'object' && err !== null && 'statusCode' in err;
}

export function isValidationError(
  err: unknown
): err is ApiError & { validationErrors: ValidationFieldError[] } {
  return (
    isApiError(err) &&
    Array.isArray((err as ApiError).validationErrors) &&
    (err as ApiError).validationErrors!.length > 0
  );
}

export function mapValidationErrors(err: unknown): Record<string, string> | null {
  if (!isValidationError(err)) return null;
  const out: Record<string, string> = {};
  for (const e of err.validationErrors) {
    if (!e.field) continue;
    if (!out[e.field]) out[e.field] = e.message;
  }
  return out;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getMessageFromPayload(payload: unknown): string | undefined {
  if (!isRecord(payload)) return undefined;
  const error = payload.error;
  if (typeof error === 'string' && error.trim()) return error;
  const message = payload.message;
  if (typeof message === 'string' && message.trim()) return message;
  return undefined;
}

/**
 * Expects backend payload like:
 * { errors: [{ field: "firstName", message: "...", code: "required" }, ...] }
 */
function extractValidationErrors(payload: unknown): ValidationFieldError[] | undefined {
  if (!isRecord(payload)) return undefined;

  const raw = (payload as Record<string, unknown>).errors;
  if (!Array.isArray(raw)) return undefined;

  const normalized: ValidationFieldError[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;

    const field = typeof item.field === 'string' ? item.field.trim() : '';
    const message =
      typeof item.message === 'string' && item.message.trim()
        ? item.message.trim()
        : 'Invalid value';
    const code =
      typeof item.code === 'string' && item.code.trim() ? item.code.trim() : undefined;

    normalized.push({ field, code, message });
  }

  return normalized.length > 0 ? normalized : undefined;
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (isRecord(err)) {
    const message = getMessageFromPayload(err);
    if (message) return message;
  }
  return 'Network error';
}

function normalizeDailyStats(payload: unknown): FormSubmissionDailyStat[] {
  const extractArray = (value: unknown): unknown[] => {
    if (Array.isArray(value)) return value;
    if (!isRecord(value)) return [];
    const maybe = value.data ?? value.daily ?? value.stats ?? value.results;
    if (Array.isArray(maybe)) return maybe;
    if (isRecord(maybe)) {
      const nested = maybe.data ?? maybe.daily ?? maybe.stats ?? maybe.results;
      if (Array.isArray(nested)) return nested;
    }
    return [];
  };

  const rows = extractArray(payload);
  const normalized: FormSubmissionDailyStat[] = [];

  rows.forEach((row) => {
    if (!isRecord(row)) return;
    const dateRaw =
      (row.date as unknown) ??
      (row.day as unknown) ??
      (row.label as unknown) ??
      (row.createdAt as unknown) ??
      (row.created_at as unknown);
    const countRaw =
      (row.count as unknown) ??
      (row.total as unknown) ??
      (row.value as unknown) ??
      (row.registrations as unknown) ??
      (row.submissions as unknown);

    const date = typeof dateRaw === 'string' ? dateRaw : dateRaw ? String(dateRaw) : '';
    const count = typeof countRaw === 'number' ? countRaw : Number(countRaw);

    if (!date || Number.isNaN(count)) return;
    normalized.push({ date, count });
  });

  return normalized;
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

async function safeParseJson(response: Response): Promise<unknown | null> {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_V1_BASE_URL}${endpoint}`;
  const isFormData =
    typeof FormData !== 'undefined' && options.body instanceof FormData;

  const headers: HeadersInit = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers || {}),
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });

    const json = await safeParseJson(response);
    const payload: unknown =
      json ?? { message: await response.text().catch(() => '') };

    if (!response.ok) {
      const validationErrors = extractValidationErrors(payload);
      throw createApiError(
        getMessageFromPayload(payload) || 'Request failed',
        response.status,
        payload,
        validationErrors
      );
    }

    return payload as T;
  } catch (err) {
    if (isApiError(err)) throw err;
    throw createApiError(getErrorMessage(err), 0, err);
  }
}

/**
 * Upload fetch: same as apiFetch but allows a different origin for CDN/upload proxies.
 */
async function uploadFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${UPLOAD_V1_BASE_URL}${endpoint}`;
  const isFormData =
    typeof FormData !== 'undefined' && options.body instanceof FormData;

  const headers: HeadersInit = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers || {}),
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });

    const json = await safeParseJson(response);
    const payload: unknown =
      json ?? { message: await response.text().catch(() => '') };

    if (!response.ok) {
      const validationErrors = extractValidationErrors(payload);
      throw createApiError(
        getMessageFromPayload(payload) || 'Request failed',
        response.status,
        payload,
        validationErrors
      );
    }

    return payload as T;
  } catch (err) {
    if (isApiError(err)) throw err;
    throw createApiError(getErrorMessage(err), 0, err);
  }
}

/** Root fetch (NOT /api/v1). Needed for /health. */
async function rootFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_ORIGIN}${endpoint}`;
  const headers: HeadersInit = { ...(options.headers || {}) };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });

    const json = await safeParseJson(response);
    const payload: unknown =
      json ?? { message: await response.text().catch(() => '') };

    if (!response.ok) {
      const validationErrors = extractValidationErrors(payload);
      throw createApiError(
        getMessageFromPayload(payload) || 'Request failed',
        response.status,
        payload,
        validationErrors
      );
    }

    return payload as T;
  } catch (err) {
    if (isApiError(err)) throw err;
    throw createApiError(getErrorMessage(err), 0, err);
  }
}

/* ============================================================================
   Response Normalizers
============================================================================ */

function isUserLike(value: unknown): value is User {
  if (!isRecord(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === 'string' && typeof record.email === 'string';
}

function extractUser(response: unknown): User {
  const data =
    isRecord(response) && 'data' in response
      ? (response as { data?: unknown }).data
      : response;

  if (isRecord(data) && isUserLike((data as { user?: unknown }).user)) {
    return (data as { user: User }).user;
  }
  if (isUserLike(data)) return data;

  throw createApiError('Invalid user payload', 400, response);
}

function unwrapData<T>(res: unknown, errorMessage: string): T {
  if (isRecord(res) && 'data' in res) {
    const data = (res as Record<string, unknown>)['data'];
    if (data === undefined || data === null) {
      throw createApiError(errorMessage, 400, res);
    }
    return data as T;
  }
  throw createApiError(errorMessage, 400, res);
}

function unwrapSimplePaginated<T>(
  res: unknown,
  errorMessage: string
): SimplePaginatedResponse<T> {
  const toNumber = (v: unknown): number | undefined => {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    }
    return undefined;
  };

  const build = (record: Record<string, unknown>): SimplePaginatedResponse<T> | null => {
    const data = Array.isArray(record.data) ? (record.data as T[]) : undefined;
    const meta = isRecord(record.meta) ? (record.meta as Record<string, unknown>) : undefined;

    const total =
      toNumber(record.total) ??
      toNumber(record.total_items) ??
      toNumber(record.count) ??
      (meta ? toNumber(meta.total) ?? toNumber(meta.total_items) ?? toNumber(meta.count) : undefined);

    const page = toNumber(record.page) ?? (meta ? toNumber(meta.page) : undefined);
    const limit =
      toNumber(record.limit) ??
      toNumber(record.per_page) ??
      (meta ? toNumber(meta.limit) ?? toNumber(meta.per_page) : undefined);

    const totalPages =
      toNumber(record.totalPages) ??
      toNumber(record.total_pages) ??
      (meta ? toNumber(meta.totalPages) ?? toNumber(meta.total_pages) : undefined);

    if (!data || total === undefined) return null;

    const safeLimit = limit ?? Math.max(data.length, 1);
    const safePage = page ?? 1;
    const safeTotalPages = totalPages ?? Math.max(1, Math.ceil(total / safeLimit));

    return {
      data,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: safeTotalPages,
    };
  };

  if (isRecord(res)) {
    const direct = build(res as Record<string, unknown>);
    if (direct) return direct;

    if ('data' in res && isRecord((res as Record<string, unknown>).data)) {
      const inner = build((res as Record<string, unknown>).data as Record<string, unknown>);
      if (inner) return inner;
    }
  }

  throw createApiError(errorMessage, 400, res);
}

function extractLoginResult(res: unknown): LoginResult {
  const data =
    isRecord(res) && 'data' in res ? (res as { data?: unknown }).data : res;

  if (isRecord(data) && isUserLike((data as Record<string, unknown>).user)) {
    return { user: (data as { user: User }).user };
  }

  if (isRecord(data) && (data as Record<string, unknown>).otp_required === true) {
    const d = data as Record<string, unknown>;
    return {
      otp_required: true,
      purpose: typeof d.purpose === 'string' ? d.purpose : 'login',
      expires_at: typeof d.expires_at === 'string' ? d.expires_at : undefined,
      action_url: typeof d.action_url === 'string' ? d.action_url : undefined,
      email: typeof d.email === 'string' ? d.email : '',
    } as LoginChallenge;
  }

  throw createApiError('Invalid login payload', 400, res);
}

/* ============================================================================
   Helpers
============================================================================ */

function toQueryString(params?: Record<string, unknown>): string {
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

  async login(credentials: LoginCredentials): Promise<LoginResult> {
    const res = await apiFetch<ApiResponse<unknown>>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    return extractLoginResult(res);
  },

  async verifyLoginOtp(payload: {
    email: string;
    code: string;
    purpose: string;
    rememberMe?: boolean;
  }): Promise<User> {
    const res = await apiFetch<ApiResponse<unknown>>('/auth/login/verify-otp', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return extractUser(res);
  },

  async register(data: RegisterData): Promise<User> {
    const res = await apiFetch<ApiResponse<unknown>>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return extractUser(res);
  },

  async requestPasswordReset(payload: PasswordResetRequestPayload): Promise<SendOTPResponse> {
    const res = await apiFetch<ApiResponse<SendOTPResponse>>(
      '/auth/password-reset/request',
      { method: 'POST', body: JSON.stringify(payload) }
    );
    return unwrapData<SendOTPResponse>(res, 'Invalid password reset response');
  },

  async confirmPasswordReset(payload: PasswordResetConfirmPayload): Promise<MessageResponse> {
    return apiFetch('/auth/password-reset/confirm', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async refreshToken(): Promise<MessageResponse> {
    return apiFetch('/auth/refresh', { method: 'POST' });
  },

  async logout(): Promise<void> {
    await apiFetch('/auth/logout', { method: 'POST' });
  },

  async getCurrentUser(): Promise<User> {
    const res = await apiFetch<ApiResponse<unknown>>('/auth/me', { method: 'GET' });
    return extractUser(res);
  },

  async updateProfile(userData: Partial<User>): Promise<User> {
    const res = await apiFetch<ApiResponse<unknown>>('/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(userData),
    });
    return extractUser(res);
  },

  async changePassword(
    _currentPassword: string,
    _newPassword: string,
    payload:
      | {
          currentPassword: string;
          newPassword: string;
          confirmPassword?: string;
          email?: string;
          otpCode?: string;
        }
      | ChangePasswordData
  ): Promise<MessageResponse> {
    return apiFetch('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async clearUserData(): Promise<MessageResponse> {
    return apiFetch('/auth/clear-data', { method: 'POST' });
  },

  async deleteAccount(): Promise<MessageResponse> {
    return apiFetch('/auth/account', { method: 'DELETE' });
  },

  /* ===================== HEALTH ===================== */

  healthCheck(): Promise<HealthCheckResponse> {
    return rootFetch('/healthz', { method: 'GET' });
  },

  /* ===================== TESTIMONIALS ===================== */

  async getAllTestimonials(params?: { approved?: boolean }): Promise<Testimonial[]> {
    if (params?.approved === false) {
      const res = await apiFetch<ApiResponse<Testimonial[]>>('/admin/testimonials/pending');
      return unwrapData<Testimonial[]>(res, 'Invalid testimonials payload');
    }

    const qs = params?.approved !== undefined ? `?approved=${params.approved}` : '';
    const res = await apiFetch<ApiResponse<Testimonial[]>>(`/testimonials/all${qs}`);
    return unwrapData<Testimonial[]>(res, 'Invalid testimonials payload');
  },

  getPaginatedTestimonials(params?: Record<string, string>): Promise<PaginatedResponse<Testimonial>> {
    const qs = params ? `?${new URLSearchParams(params)}` : '';
    return apiFetch(`/testimonials${qs}`);
  },

  async getTestimonialById(id: string): Promise<Testimonial> {
    const res = await apiFetch<ApiResponse<Testimonial>>(`/testimonials/${encodeURIComponent(id)}`);
    return unwrapData<Testimonial>(res, 'Invalid testimonial payload');
  },

  async createTestimonial(data: CreateTestimonialData): Promise<Testimonial> {
    const res = await apiFetch<ApiResponse<Testimonial>>('/testimonials', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return unwrapData<Testimonial>(res, 'Invalid testimonial payload');
  },

  async updateTestimonial(id: string, data: UpdateTestimonialData): Promise<Testimonial> {
    const res = await apiFetch<ApiResponse<Testimonial>>(`/admin/testimonials/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return unwrapData<Testimonial>(res, 'Invalid testimonial payload');
  },

  deleteTestimonial(id: string) {
    return apiFetch(`/admin/testimonials/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  approveTestimonial(id: string) {
    return apiFetch(`/admin/testimonials/${encodeURIComponent(id)}/approve`, { method: 'PATCH' });
  },

  /* ===================== ADMIN ===================== */

  async getDashboardStats(): Promise<Record<string, unknown>> {
    const res = await apiFetch<ApiResponse<unknown>>('/admin/dashboard');
    return unwrapData<Record<string, unknown>>(res, 'Invalid dashboard stats');
  },

  getAllUsers(params?: Record<string, string>) {
    const qs = params ? `?${new URLSearchParams(params)}` : '';
    return apiFetch(`/admin/users${qs}`);
  },

  /* ===================== ANALYTICS ===================== */

  async getAnalytics(params?: Record<string, unknown>): Promise<DashboardAnalytics> {
    const qs = toQueryString(params);
    const res = await apiFetch<ApiResponse<DashboardAnalytics>>(`/admin/analytics${qs}`, { method: 'GET' });
    return unwrapData<DashboardAnalytics>(res, 'Invalid analytics payload');
  },

  /* ===================== EVENTS ===================== */

  async getEvents(params?: Record<string, unknown>): Promise<SimplePaginatedResponse<EventData>> {
    const qs = toQueryString(params);
    const res = await apiFetch(`/admin/events${qs}`, { method: 'GET' });
    return unwrapSimplePaginated<EventData>(res, 'Invalid events payload');
  },

  async getEvent(id: string): Promise<EventData> {
    const res = await apiFetch<{ data: EventData }>(`/events/${encodeURIComponent(id)}`, { method: 'GET' });
    return unwrapData<EventData>(res, 'Invalid event payload');
  },

  async createEvent(data: EventPayload): Promise<EventData> {
    const res = await apiFetch<{ data: EventData }>('/admin/events', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return unwrapData<EventData>(res, 'Invalid event payload');
  },

  async updateEvent(id: string, data: EventPayload): Promise<EventData> {
    const res = await apiFetch<{ data: EventData }>(`/admin/events/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return unwrapData<EventData>(res, 'Invalid event payload');
  },

  async deleteEvent(id: string): Promise<MessageResponse> {
    return apiFetch(`/admin/events/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  async uploadEventImage(id: string, file: File): Promise<EventData> {
    const form = new FormData();
    form.append('file', file);
    const res = await uploadFetch<{ data: EventData }>(`/admin/events/${encodeURIComponent(id)}/image`, {
      method: 'POST',
      body: form,
    });
    return unwrapData<EventData>(res, 'Invalid upload image payload');
  },

  async uploadEventBanner(id: string, file: File): Promise<EventData> {
    const form = new FormData();
    form.append('file', file);
    const res = await uploadFetch<{ data: EventData }>(`/admin/events/${encodeURIComponent(id)}/banner`, {
      method: 'POST',
      body: form,
    });
    return unwrapData<EventData>(res, 'Invalid upload banner payload');
  },

  /* ===================== REELS ===================== */

  async getReels(params?: Record<string, unknown>): Promise<SimplePaginatedResponse<ReelData>> {
    const qs = toQueryString(params);
    return apiFetch(`/admin/reels${qs}`, { method: 'GET' });
  },

  async createReel(payload: CreateReelData): Promise<ReelData> {
    const res = await apiFetch<{ data: ReelData }>('/admin/reels', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return unwrapData<ReelData>(res, 'Invalid reel payload');
  },

  async deleteReel(id: string): Promise<MessageResponse> {
    return apiFetch(`/admin/reels/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  async createUploadPresign(payload: UploadPresignRequest): Promise<UploadPresignResponse> {
    const res = await apiFetch<{ data: UploadPresignResponse }>('/admin/uploads/presign', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return unwrapData<UploadPresignResponse>(res, 'Invalid upload presign payload');
  },

  /* ===================== FORMS (ADMIN) ===================== */

  async getAdminForms(params?: Record<string, unknown>): Promise<SimplePaginatedResponse<AdminForm>> {
    const qs = toQueryString(params);
    const res = await apiFetch(`/admin/forms${qs}`, { method: 'GET' });
    return unwrapSimplePaginated<AdminForm>(res, 'Invalid forms payload');
  },

  async getAdminForm(id: string): Promise<AdminForm> {
    const res = await apiFetch<{ data: AdminForm }>(`/admin/forms/${encodeURIComponent(id)}`, { method: 'GET' });
    return unwrapData<AdminForm>(res, 'Invalid form payload');
  },

  async createAdminForm(payload: CreateFormRequest): Promise<AdminForm> {
    const res = await apiFetch<{ data: AdminForm }>('/admin/forms', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return unwrapData<AdminForm>(res, 'Invalid form payload');
  },

  async updateAdminForm(id: string, payload: UpdateFormRequest): Promise<AdminForm> {
    const res = await apiFetch<{ data: AdminForm }>(`/admin/forms/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return unwrapData<AdminForm>(res, 'Invalid form payload');
  },

  async uploadFormBanner(id: string, file: File): Promise<AdminForm> {
    const form = new FormData();
    form.append('file', file);
    const res = await uploadFetch<{ data: AdminForm }>(`/admin/forms/${encodeURIComponent(id)}/banner`, {
      method: 'POST',
      body: form,
    });
    return unwrapData<AdminForm>(res, 'Invalid upload banner payload');
  },

  async deleteAdminForm(id: string): Promise<MessageResponse> {
    return apiFetch(`/admin/forms/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  async publishAdminForm(
    id: string
  ): Promise<{ slug: string; publicUrl?: string; publishedAt?: string; status?: FormStatus }> {
    const res = await apiFetch<{
      data: { slug: string; publicUrl?: string; publishedAt?: string; status?: FormStatus };
    }>(
      `/admin/forms/${encodeURIComponent(id)}/publish`,
      {
      method: 'POST',
      }
    );
    return unwrapData<{ slug: string; publicUrl?: string; publishedAt?: string; status?: FormStatus }>(
      res,
      'Invalid publish payload'
    );
  },

  async getFormSubmissions(id: string, params?: Record<string, unknown>): Promise<SimplePaginatedResponse<FormSubmission>> {
    const qs = toQueryString(params);
    const res = await apiFetch(`/admin/forms/${encodeURIComponent(id)}/submissions${qs}`, { method: 'GET' });
    return unwrapSimplePaginated<FormSubmission>(res, 'Invalid submissions payload');
  },

  async getFormSubmissionStats(id: string): Promise<FormSubmissionDailyStat[]> {
    const res = await apiFetch<unknown>(`/admin/forms/${encodeURIComponent(id)}/submissions/stats`, { method: 'GET' });
    return normalizeDailyStats(res);
  },

  async getFormStats(params?: Record<string, unknown>): Promise<FormStatsResponse> {
    const qs = toQueryString(params);
    const res = await apiFetch<ApiResponse<FormStatsResponse>>(`/admin/forms/stats${qs}`, { method: 'GET' });
    return unwrapData<FormStatsResponse>(res, 'Invalid form stats payload');
  },

  /* ===================== FORMS (PUBLIC) ===================== */

  async getPublicForm(slug: string): Promise<PublicFormPayload> {
    const res = await apiFetch<{ data: PublicFormPayload }>(`/forms/${encodeURIComponent(slug)}`, { method: 'GET' });
    return unwrapData<PublicFormPayload>(res, 'Invalid public form payload');
  },

  async submitPublicForm(slug: string, payload: SubmitFormRequest | FormData): Promise<MessageResponse> {
    const body = payload instanceof FormData ? payload : JSON.stringify(payload);
    return apiFetch(`/forms/${encodeURIComponent(slug)}/submissions`, {
      method: 'POST',
      body,
    });
  },

  /* ===================== SUBSCRIBERS + NOTIFICATIONS ===================== */

  async subscribe(payload: SubscribeRequest): Promise<Subscriber> {
    const res = await apiFetch<ApiResponse<Subscriber>>('/notifications/subscribe', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return unwrapData<Subscriber>(res, 'Invalid subscriber payload');
  },

  async unsubscribe(payload: UnsubscribeRequest): Promise<MessageResponse> {
    return apiFetch('/notifications/unsubscribe', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async listSubscribers(params?: Record<string, unknown>): Promise<SimplePaginatedResponse<Subscriber>> {
    const qs = toQueryString(params);
    return apiFetch(`/admin/notifications/subscribers${qs}`, { method: 'GET' });
  },

  async sendNotification(payload: SendNotificationRequest): Promise<SendNotificationResult> {
    const res = await apiFetch<ApiResponse<SendNotificationResult>>('/admin/notifications/send', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return unwrapData<SendNotificationResult>(res, 'Invalid notification payload');
  },

  /* ===================== OTP ===================== */

  async sendOtp(payload: SendOTPRequest): Promise<SendOTPResponse> {
    const res = await apiFetch<ApiResponse<SendOTPResponse>>('/otp/send', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return unwrapData<SendOTPResponse>(res, 'Invalid OTP send response');
  },

  async verifyOtp(payload: VerifyOTPRequest): Promise<VerifyOTPResponse> {
    const res = await apiFetch<ApiResponse<VerifyOTPResponse>>('/otp/verify', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return unwrapData<VerifyOTPResponse>(res, 'Invalid OTP verify response');
  },

  /* ===================== WORKFORCE ===================== */

  async listWorkforce(params?: Record<string, unknown>): Promise<SimplePaginatedResponse<WorkforceMember>> {
    const qs = toQueryString(params);
    return apiFetch(`/admin/workforce${qs}`, { method: 'GET' });
  },

  async createWorkforce(payload: CreateWorkforceRequest): Promise<WorkforceMember> {
    const res = await apiFetch<ApiResponse<WorkforceMember>>('/admin/workforce', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return unwrapData<WorkforceMember>(res, 'Invalid workforce payload');
  },

  async updateWorkforce(id: string, payload: UpdateWorkforceRequest): Promise<WorkforceMember> {
    const res = await apiFetch<ApiResponse<WorkforceMember>>(`/admin/workforce/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return unwrapData<WorkforceMember>(res, 'Invalid workforce payload');
  },

  async approveWorkforce(id: string, payload?: Record<string, unknown>): Promise<WorkforceMember> {
    const res = await apiFetch<ApiResponse<WorkforceMember>>(`/admin/workforce/${encodeURIComponent(id)}/approve`, {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    });
    return unwrapData<WorkforceMember>(res, 'Invalid workforce payload');
  },

  async applyToWorkforce(payload: CreateWorkforceRequest): Promise<WorkforceMember> {
    const res = await apiFetch<ApiResponse<WorkforceMember>>('/workforce/apply', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return unwrapData<WorkforceMember>(res, 'Invalid workforce payload');
  },

  async getWorkforceStats(): Promise<WorkforceStatsResponse> {
    const res = await apiFetch<ApiResponse<WorkforceStatsResponse>>('/admin/workforce/stats', { method: 'GET' });
    return unwrapData<WorkforceStatsResponse>(res, 'Invalid workforce stats payload');
  },

  /* ===================== WORKFORCE (BIRTHDAYS) ===================== */

  async getWorkforceBirthdayStats(): Promise<Record<string, unknown>> {
    const res = await apiFetch<ApiResponse<Record<string, unknown>>>('/admin/workforce/birthdays/stats', {
      method: 'GET',
    });
    return unwrapData<Record<string, unknown>>(res, 'Invalid birthday stats payload');
  },

  async getWorkforceBirthdaysByMonth(month: number): Promise<WorkforceMember[]> {
    const res = await apiFetch<ApiResponse<unknown> | WorkforceMember[]>(
      `/admin/workforce/birthdays/month/${encodeURIComponent(String(month))}`,
      { method: 'GET' }
    );
    if (Array.isArray(res)) return res;
    const payload = unwrapData<unknown>(res, 'Invalid birthdays by month payload');
    if (Array.isArray(payload)) return payload as WorkforceMember[];
    if (isRecord(payload) && Array.isArray(payload.data)) return payload.data as WorkforceMember[];
    return [];
  },

  async getWorkforceBirthdaysToday(): Promise<WorkforceMember[]> {
    const res = await apiFetch<ApiResponse<unknown> | WorkforceMember[]>('/admin/workforce/birthdays/today', {
      method: 'GET',
    });
    if (Array.isArray(res)) return res;
    const payload = unwrapData<unknown>(res, 'Invalid birthdays today payload');
    if (Array.isArray(payload)) return payload as WorkforceMember[];
    if (isRecord(payload) && Array.isArray(payload.data)) return payload.data as WorkforceMember[];
    return [];
  },

  async sendWorkforceBirthdaysToday(): Promise<Record<string, number>> {
    const res = await apiFetch<ApiResponse<Record<string, number>>>('/admin/workforce/birthdays/send-today', {
      method: 'POST',
    });
    return unwrapData<Record<string, number>>(res, 'Invalid birthday send payload');
  },
};

export default apiClient;
