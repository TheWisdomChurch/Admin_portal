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
  Member,
  CreateMemberRequest,
  UpdateMemberRequest,
  LeadershipMember,
  CreateLeadershipRequest,
  UpdateLeadershipRequest,
  PasswordResetRequestPayload,
  PasswordResetConfirmPayload,
  LoginResult,
  LoginChallenge,
  AuthSecurityProfile,
  ChangePasswordData,
  HealthCheckResponse,
  UploadPresignRequest,
  UploadPresignResponse,
  UploadAssetData,
  UploadImageResponse,
  EmailTemplate,
  CreateEmailTemplateRequest,
  UpdateEmailTemplateRequest,
  AdminNotificationInbox,
  ApprovalRequest,
  ApprovalRequestsTimeline,
  TOTPSetupResponse,
  FormReportLinkPayload,
  AdminEmailMarketingFormItem,
  AdminEmailMarketingSummary,
  AdminEmailAudiencePreview,
  SendAdminComposeEmailRequest,
  SendAdminComposeEmailResponse,
  AdminEmailDeliveryHistoryItem,
  HomepageAdContent,
  ConfessionPopupContent,
  PastoralCareRequestAdmin,
  GivingIntentAdmin,
  StoreProductAdmin,
  UpsertStoreProductRequest,
  StoreOrdersPaginated,
  StoreOrderAdmin,
  StoreOrderStatus,
  MFAMethod,
} from './types';

/* ============================================================================
   API CLIENT CONFIG
============================================================================ */

/**
 * Normalize an origin string:
 * - trims
 * - removes trailing slashes
 * - strips a trailing /api/v1 if someone passes that
 */
function normalizeOrigin(raw?: string | null): string {
  if (!raw || !raw.trim()) {
    throw new Error(
      '[api] Missing API origin. Set NEXT_PUBLIC_API_URL or NEXT_PUBLIC_BACKEND_URL, or use the same-origin proxy.'
    );
  }

  let base = raw.trim().replace(/\/+$/, '');
  if (base.endsWith('/api/v1')) base = base.slice(0, -'/api/v1'.length);
  return base;
}

function requireOrigin(origin: string, message: string): string {
  if (!origin) {
    throw new Error(message);
  }
  return origin;
}

// Default to the same-origin proxy unless explicitly disabled.
const USE_API_PROXY = process.env.NEXT_PUBLIC_API_PROXY !== 'false';

const RAW_API_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL;
const API_ORIGIN = RAW_API_ORIGIN ? normalizeOrigin(RAW_API_ORIGIN) : '';

// When proxy is enabled, all API calls go to same-origin:
const API_V1_BASE_URL = USE_API_PROXY
  ? '/api/v1'
  : `${requireOrigin(
      API_ORIGIN,
      '[api] Missing NEXT_PUBLIC_API_URL or NEXT_PUBLIC_BACKEND_URL while NEXT_PUBLIC_API_PROXY=false.'
    )}/api/v1`;

// Uploads: route through same proxy too if you want cookies/session consistently
const RAW_UPLOAD_ORIGIN =
  process.env.NEXT_PUBLIC_UPLOAD_BASE_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.NEXT_PUBLIC_BACKEND_URL;
const UPLOAD_ORIGIN = RAW_UPLOAD_ORIGIN ? normalizeOrigin(RAW_UPLOAD_ORIGIN) : '';

const UPLOAD_V1_BASE_URL = USE_API_PROXY
  ? '/api/v1'
  : `${requireOrigin(
      UPLOAD_ORIGIN,
      '[api] Missing NEXT_PUBLIC_UPLOAD_BASE_URL or API origin while NEXT_PUBLIC_API_PROXY=false.'
    )}/api/v1`;

let authUserCache: User | null = null;
let authRememberPreference = false;

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

function normalizeAbsoluteHttpUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  let candidate = trimmed;
  if (candidate.startsWith('//')) {
    candidate = `https:${candidate}`;
  }
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  try {
    const parsed = new URL(candidate);
    if ((parsed.protocol === 'https:' || parsed.protocol === 'http:') && parsed.host) {
      return parsed.toString();
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function sanitizeScalarVisibilityValue(value: unknown): string | number | boolean | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  return undefined;
}

function sanitizeVisibilityShape(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object') return undefined;

  const rawVisibility = value as Record<string, unknown>;
  const rawRules = Array.isArray(rawVisibility.rules) ? rawVisibility.rules : [];
  if (rawRules.length === 0) return undefined;

  const rules = rawRules.reduce<Record<string, unknown>[]>((acc, rule) => {
    if (!rule || typeof rule !== 'object') return acc;
    const rawRule = rule as Record<string, unknown>;
    const fieldKey = typeof rawRule.fieldKey === 'string' ? rawRule.fieldKey.trim() : '';
    if (!fieldKey) return acc;

    const operator =
      rawRule.operator === 'equals' ||
      rawRule.operator === 'not_equals' ||
      rawRule.operator === 'in' ||
      rawRule.operator === 'not_in'
        ? rawRule.operator
        : 'equals';

    if (operator === 'in' || operator === 'not_in') {
      const values = Array.isArray(rawRule.values)
        ? rawRule.values
            .map((item) => sanitizeScalarVisibilityValue(item))
            .filter((item): item is string | number | boolean => typeof item !== 'undefined')
        : [];
      if (values.length === 0) return acc;
      acc.push({ fieldKey, operator, values });
      return acc;
    }

    const scalarValue = sanitizeScalarVisibilityValue(rawRule.value);
    if (typeof scalarValue === 'undefined') return acc;
    acc.push({ fieldKey, operator, value: scalarValue });
    return acc;
  }, []);

  if (rules.length === 0) return undefined;

  return {
    match: rawVisibility.match === 'any' ? 'any' : 'all',
    rules,
  };
}

function sanitizeFormPayload<T extends CreateFormRequest | UpdateFormRequest>(payload: T): T {
  if (!payload || typeof payload !== 'object') return payload;

  const nextPayload = { ...payload } as T;

  if ('settings' in payload && payload.settings) {
    const nextSettings = { ...(payload.settings as Record<string, unknown>) };
    if ('responseEmailTemplateUrl' in nextSettings) {
      const normalized = normalizeAbsoluteHttpUrl(nextSettings.responseEmailTemplateUrl);
      if (normalized) {
        nextSettings.responseEmailTemplateUrl = normalized;
      } else {
        delete nextSettings.responseEmailTemplateUrl;
      }
    }
    if ('campaignEmailTemplateUrl' in nextSettings) {
      const normalized = normalizeAbsoluteHttpUrl(nextSettings.campaignEmailTemplateUrl);
      if (normalized) {
        nextSettings.campaignEmailTemplateUrl = normalized;
      } else {
        delete nextSettings.campaignEmailTemplateUrl;
      }
    }

    (nextPayload as T & { settings?: typeof nextSettings }).settings = nextSettings;
  }

  if ('fields' in payload && Array.isArray(payload.fields)) {
    (nextPayload as unknown as { fields?: unknown[] }).fields = payload.fields.map((field) => {
      if (!field || typeof field !== 'object') return field;
      const nextField = { ...(field as Record<string, unknown>) };
      const nextVisibility = sanitizeVisibilityShape(nextField.visibility);
      if (nextVisibility) {
        nextField.visibility = nextVisibility;
      } else {
        delete nextField.visibility;
      }
      return nextField;
    });
  }

  return nextPayload;
}

/* ============================================================================
   Auth Storage (stores user profile only; cookie holds session)
============================================================================ */

export function getAuthUser(): User | null {
  return authUserCache;
}

export function setAuthUser(user: User, rememberMe = false): void {
  authUserCache = user;
  authRememberPreference = !!rememberMe;
}

export function getAuthRememberPreference(): boolean {
  return authRememberPreference;
}

export function setAuthRememberPreference(rememberMe: boolean): void {
  authRememberPreference = !!rememberMe;
}

export function clearAuthStorage(): void {
  authUserCache = null;
  authRememberPreference = false;
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

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
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
  const url = `${requireOrigin(
    API_ORIGIN,
    '[api] Missing NEXT_PUBLIC_API_URL or NEXT_PUBLIC_BACKEND_URL for direct root requests.'
  )}${endpoint}`;
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

function isMFAMethod(value: unknown): value is MFAMethod {
  return value === 'email_otp' || value === 'totp';
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
      mfa_method: isMFAMethod(d.mfa_method) ? d.mfa_method : 'email_otp',
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
    method?: MFAMethod;
    rememberMe?: boolean;
  }): Promise<User> {
    const res = await apiFetch<ApiResponse<unknown>>('/auth/login/verify-otp', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return extractUser(res);
  },

  async resendLoginOtp(payload: { email: string }): Promise<LoginChallenge> {
    const res = await apiFetch<ApiResponse<unknown>>('/auth/login/resend-otp', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const challenge = extractLoginResult(res);
    if ('otp_required' in challenge && challenge.otp_required) {
      return challenge;
    }
    throw createApiError('Invalid login challenge payload', 400, res);
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

  async getMFASecurityProfile(): Promise<AuthSecurityProfile> {
    const res = await apiFetch<ApiResponse<AuthSecurityProfile>>('/auth/mfa', { method: 'GET' });
    return unwrapData<AuthSecurityProfile>(res, 'Invalid MFA security profile payload');
  },

  async beginTotpSetup(): Promise<TOTPSetupResponse> {
    const res = await apiFetch<ApiResponse<TOTPSetupResponse>>('/auth/mfa/totp/setup', {
      method: 'POST',
    });
    return unwrapData<TOTPSetupResponse>(res, 'Invalid authenticator setup payload');
  },

  async enableTotp(code: string): Promise<AuthSecurityProfile> {
    const res = await apiFetch<ApiResponse<AuthSecurityProfile>>('/auth/mfa/totp/enable', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
    return unwrapData<AuthSecurityProfile>(res, 'Invalid authenticator enable payload');
  },

  async disableTotp(code: string): Promise<AuthSecurityProfile> {
    const res = await apiFetch<ApiResponse<AuthSecurityProfile>>('/auth/mfa/totp/disable', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
    return unwrapData<AuthSecurityProfile>(res, 'Invalid authenticator disable payload');
  },

  async setPreferredMfaMethod(method: MFAMethod): Promise<AuthSecurityProfile> {
    const res = await apiFetch<ApiResponse<AuthSecurityProfile>>('/auth/mfa/method', {
      method: 'PATCH',
      body: JSON.stringify({ method }),
    });
    return unwrapData<AuthSecurityProfile>(res, 'Invalid MFA preference payload');
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

  async getAdminEvent(id: string): Promise<EventData> {
    const res = await apiFetch<{ data: EventData }>(`/admin/events/${encodeURIComponent(id)}`, { method: 'GET' });
    return unwrapData<EventData>(res, 'Invalid admin event payload');
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
    const normalizedPayload: UploadPresignRequest = {
      ...payload,
      sizeBytes: payload.sizeBytes ?? payload.size,
    };
    const res = await apiFetch<{ data: UploadPresignResponse }>('/admin/uploads/presign', {
      method: 'POST',
      body: JSON.stringify(normalizedPayload),
    });
    return unwrapData<UploadPresignResponse>(res, 'Invalid upload presign payload');
  },

  async completeUploadAsset(assetId: string): Promise<UploadAssetData> {
    const res = await apiFetch<{ data: UploadAssetData }>(
      `/admin/uploads/${encodeURIComponent(assetId)}/complete`,
      { method: 'POST' }
    );
    return unwrapData<UploadAssetData>(res, 'Invalid upload completion payload');
  },

  async uploadImage(file: File, folder = 'uploads'): Promise<UploadImageResponse> {
    const form = new FormData();
    form.append('file', file);
    form.append('folder', folder);
    const res = await uploadFetch<{ data: UploadImageResponse }>('/admin/uploads/images', {
      method: 'POST',
      body: form,
    });
    return unwrapData<UploadImageResponse>(res, 'Invalid image upload payload');
  },

  async createAdminEmailTemplate(payload: CreateEmailTemplateRequest): Promise<EmailTemplate> {
    const res = await apiFetch<{ data: EmailTemplate }>('/admin/email/templates', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return unwrapData<EmailTemplate>(res, 'Invalid email template payload');
  },

  async listAdminEmailTemplates(params?: Record<string, unknown>): Promise<SimplePaginatedResponse<EmailTemplate>> {
    const qs = toQueryString(params);
    const res = await apiFetch(`/admin/email/templates${qs}`, { method: 'GET' });
    return unwrapSimplePaginated<EmailTemplate>(res, 'Invalid email templates payload');
  },

  async getAdminEmailTemplate(id: string): Promise<EmailTemplate> {
    const res = await apiFetch<{ data: EmailTemplate }>(`/admin/email/templates/${encodeURIComponent(id)}`, {
      method: 'GET',
    });
    return unwrapData<EmailTemplate>(res, 'Invalid email template payload');
  },

  async updateAdminEmailTemplate(id: string, payload: UpdateEmailTemplateRequest): Promise<EmailTemplate> {
    const res = await apiFetch<{ data: EmailTemplate }>(`/admin/email/templates/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return unwrapData<EmailTemplate>(res, 'Invalid email template payload');
  },

  async activateAdminEmailTemplate(id: string): Promise<EmailTemplate> {
    const res = await apiFetch<{ data: EmailTemplate }>(
      `/admin/email/templates/${encodeURIComponent(id)}/activate`,
      { method: 'POST' }
    );
    return unwrapData<EmailTemplate>(res, 'Invalid email template payload');
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
    const sanitizedPayload = sanitizeFormPayload(payload);
    const res = await apiFetch<{ data: AdminForm }>('/admin/forms', {
      method: 'POST',
      body: JSON.stringify(sanitizedPayload),
    });
    return unwrapData<AdminForm>(res, 'Invalid form payload');
  },

  async updateAdminForm(id: string, payload: UpdateFormRequest): Promise<AdminForm> {
    const sanitizedPayload = sanitizeFormPayload(payload);
    const res = await apiFetch<{ data: AdminForm }>(`/admin/forms/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(sanitizedPayload),
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

  async getAdminFormReportLink(id: string): Promise<FormReportLinkPayload> {
    const res = await apiFetch<ApiResponse<FormReportLinkPayload>>(
      `/admin/forms/${encodeURIComponent(id)}/report-link`,
      { method: 'GET' }
    );
    return unwrapData<FormReportLinkPayload>(res, 'Invalid report link payload');
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

  async getEmailMarketingSummary(): Promise<AdminEmailMarketingSummary> {
    const res = await apiFetch<ApiResponse<AdminEmailMarketingSummary>>('/admin/email/marketing/summary', { method: 'GET' });
    return unwrapData<AdminEmailMarketingSummary>(res, 'Invalid email marketing summary payload');
  },

  async listEmailMarketingForms(params?: Record<string, unknown>): Promise<SimplePaginatedResponse<AdminEmailMarketingFormItem>> {
    const qs = toQueryString(params);
    const res = await apiFetch(`/admin/email/marketing/forms${qs}`, { method: 'GET' });
    return unwrapSimplePaginated<AdminEmailMarketingFormItem>(res, 'Invalid email marketing forms payload');
  },

  async previewEmailMarketingAudience(formIds: string[], limit = 25): Promise<AdminEmailAudiencePreview> {
    const params = new URLSearchParams();
    formIds.forEach((formId) => {
      const normalized = formId.trim();
      if (normalized) params.append('formIds', normalized);
    });
    if (limit > 0) {
      params.set('limit', String(limit));
    }
    const qs = params.toString();
    const res = await apiFetch<ApiResponse<AdminEmailAudiencePreview>>(
      `/admin/email/marketing/audience/preview${qs ? `?${qs}` : ''}`,
      { method: 'GET' }
    );
    return unwrapData<AdminEmailAudiencePreview>(res, 'Invalid email marketing audience preview payload');
  },

  async sendAdminComposeEmail(payload: SendAdminComposeEmailRequest): Promise<SendAdminComposeEmailResponse> {
    const res = await apiFetch<ApiResponse<SendAdminComposeEmailResponse>>('/admin/email/compose/send', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return unwrapData<SendAdminComposeEmailResponse>(res, 'Invalid admin compose email payload');
  },

  async listAdminComposeHistory(params?: Record<string, unknown>): Promise<SimplePaginatedResponse<AdminEmailDeliveryHistoryItem>> {
    const qs = toQueryString(params);
    const res = await apiFetch(`/admin/email/compose/history${qs}`, { method: 'GET' });
    return unwrapSimplePaginated<AdminEmailDeliveryHistoryItem>(res, 'Invalid admin compose history payload');
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

  async listAdminNotifications(limit = 50): Promise<AdminNotificationInbox> {
    const res = await apiFetch<ApiResponse<AdminNotificationInbox>>(
      `/admin/notifications/inbox?limit=${encodeURIComponent(String(limit))}`,
      { method: 'GET' }
    );
    return unwrapData<AdminNotificationInbox>(res, 'Invalid admin notifications payload');
  },

  async markAdminNotificationRead(id: string): Promise<MessageResponse> {
    return apiFetch(`/admin/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' });
  },

  async markAllAdminNotificationsRead(): Promise<MessageResponse> {
    return apiFetch('/admin/notifications/read-all', { method: 'POST' });
  },

  async listApprovalRequests(params?: {
    type?: string;
    status?: string;
    limit?: number;
    start?: string;
    end?: string;
  }): Promise<ApprovalRequest[]> {
    const qs = toQueryString(params as Record<string, unknown> | undefined);
    const res = await apiFetch<ApiResponse<ApprovalRequest[]> | ApprovalRequest[]>(`/admin/requests${qs}`, {
      method: 'GET',
    });
    if (Array.isArray(res)) return res;
    return unwrapData<ApprovalRequest[]>(res, 'Invalid approval requests payload');
  },

  async getApprovalRequestsTimeline(days = 14): Promise<ApprovalRequestsTimeline> {
    const res = await apiFetch<ApiResponse<ApprovalRequestsTimeline>>(
      `/admin/requests/timeline?days=${encodeURIComponent(String(days))}`,
      { method: 'GET' }
    );
    return unwrapData<ApprovalRequestsTimeline>(res, 'Invalid approval timeline payload');
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

  /* ===================== CONTENT ===================== */

  async getHomepageAdContent(): Promise<HomepageAdContent> {
    const res = await apiFetch<ApiResponse<HomepageAdContent>>('/admin/content/homepage-ad', { method: 'GET' });
    return unwrapData<HomepageAdContent>(res, 'Invalid homepage ad content payload');
  },

  async updateHomepageAdContent(payload: HomepageAdContent): Promise<HomepageAdContent> {
    const res = await apiFetch<ApiResponse<HomepageAdContent>>('/admin/content/homepage-ad', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return unwrapData<HomepageAdContent>(res, 'Invalid homepage ad content payload');
  },

  async getConfessionPopupContent(): Promise<ConfessionPopupContent> {
    const res = await apiFetch<ApiResponse<ConfessionPopupContent>>('/admin/content/confession-popup', { method: 'GET' });
    return unwrapData<ConfessionPopupContent>(res, 'Invalid confession popup content payload');
  },

  async updateConfessionPopupContent(payload: ConfessionPopupContent): Promise<ConfessionPopupContent> {
    const res = await apiFetch<ApiResponse<ConfessionPopupContent>>('/admin/content/confession-popup', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return unwrapData<ConfessionPopupContent>(res, 'Invalid confession popup content payload');
  },

  async listPastoralCareRequests(params?: Record<string, unknown>): Promise<SimplePaginatedResponse<PastoralCareRequestAdmin>> {
    const qs = toQueryString(params);
    return apiFetch(`/admin/pastoral-care/requests${qs}`, { method: 'GET' });
  },

  async listGivingIntents(params?: Record<string, unknown>): Promise<SimplePaginatedResponse<GivingIntentAdmin>> {
    const qs = toQueryString(params);
    return apiFetch(`/admin/giving/intents${qs}`, { method: 'GET' });
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

  /* ===================== MEMBERS ===================== */

  async listMembers(params?: Record<string, unknown>): Promise<SimplePaginatedResponse<Member>> {
    const qs = toQueryString(params);
    return apiFetch(`/admin/members${qs}`, { method: 'GET' });
  },

  async createMember(payload: CreateMemberRequest): Promise<Member> {
    const res = await apiFetch<ApiResponse<Member>>('/admin/members', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return unwrapData<Member>(res, 'Invalid member payload');
  },

  async updateMember(id: string, payload: UpdateMemberRequest): Promise<Member> {
    const res = await apiFetch<ApiResponse<Member>>(`/admin/members/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return unwrapData<Member>(res, 'Invalid member payload');
  },

  async deleteMember(id: string): Promise<MessageResponse> {
    return apiFetch(`/admin/members/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  /* ===================== LEADERSHIP ===================== */

  async listLeadership(params?: Record<string, unknown>): Promise<SimplePaginatedResponse<LeadershipMember>> {
    const qs = toQueryString(params);
    const res = await apiFetch(`/admin/leadership${qs}`, { method: 'GET' });
    return unwrapSimplePaginated<LeadershipMember>(res, 'Invalid leadership payload');
  },

  async createLeadership(payload: CreateLeadershipRequest): Promise<LeadershipMember> {
    const res = await apiFetch<ApiResponse<LeadershipMember>>('/admin/leadership', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return unwrapData<LeadershipMember>(res, 'Invalid leadership payload');
  },

  async updateLeadership(id: string, payload: UpdateLeadershipRequest): Promise<LeadershipMember> {
    const res = await apiFetch<ApiResponse<LeadershipMember>>(`/admin/leadership/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return unwrapData<LeadershipMember>(res, 'Invalid leadership payload');
  },

  async deleteLeadership(id: string): Promise<MessageResponse> {
    return apiFetch(`/admin/leadership/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  async approveLeadership(id: string): Promise<LeadershipMember> {
    const res = await apiFetch<ApiResponse<LeadershipMember>>(`/admin/leadership/${encodeURIComponent(id)}/approve`, {
      method: 'POST',
    });
    return unwrapData<LeadershipMember>(res, 'Invalid leadership approval payload');
  },

  async declineLeadership(id: string): Promise<LeadershipMember> {
    const res = await apiFetch<ApiResponse<LeadershipMember>>(`/admin/leadership/${encodeURIComponent(id)}/decline`, {
      method: 'POST',
    });
    return unwrapData<LeadershipMember>(res, 'Invalid leadership decline payload');
  },

  /* ===================== STORE ===================== */

  async listStoreProductsAdmin(includeInactive = true): Promise<StoreProductAdmin[]> {
    const qs = toQueryString({ includeInactive });
    const res = await apiFetch<ApiResponse<StoreProductAdmin[]> | StoreProductAdmin[]>(`/admin/store/products${qs}`, {
      method: 'GET',
    });
    if (Array.isArray(res)) return res;
    const payload = unwrapData<unknown>(res, 'Invalid store products payload');
    if (Array.isArray(payload)) return payload as StoreProductAdmin[];
    if (isRecord(payload) && Array.isArray(payload.data)) return payload.data as StoreProductAdmin[];
    return [];
  },

  async createStoreProduct(payload: UpsertStoreProductRequest): Promise<StoreProductAdmin> {
    const res = await apiFetch<ApiResponse<StoreProductAdmin>>('/admin/store/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return unwrapData<StoreProductAdmin>(res, 'Invalid store product payload');
  },

  async updateStoreProduct(id: number, payload: UpsertStoreProductRequest): Promise<StoreProductAdmin> {
    const res = await apiFetch<ApiResponse<StoreProductAdmin>>(`/admin/store/products/${encodeURIComponent(String(id))}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return unwrapData<StoreProductAdmin>(res, 'Invalid store product payload');
  },

  async updateStoreProductStock(id: number, stock: number): Promise<StoreProductAdmin> {
    const res = await apiFetch<ApiResponse<StoreProductAdmin>>(`/admin/store/products/${encodeURIComponent(String(id))}/stock`, {
      method: 'PATCH',
      body: JSON.stringify({ stock }),
    });
    return unwrapData<StoreProductAdmin>(res, 'Invalid store stock payload');
  },

  async updateStoreProductActive(id: number, isActive: boolean): Promise<StoreProductAdmin> {
    const res = await apiFetch<ApiResponse<StoreProductAdmin>>(`/admin/store/products/${encodeURIComponent(String(id))}/active`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    });
    return unwrapData<StoreProductAdmin>(res, 'Invalid store product active payload');
  },

  async listStoreOrders(params?: {
    page?: number;
    limit?: number;
    status?: StoreOrderStatus | '';
  }): Promise<StoreOrdersPaginated> {
    const qs = toQueryString(params || {});
    const res = await apiFetch<ApiResponse<StoreOrdersPaginated> | StoreOrdersPaginated>(`/admin/store/orders${qs}`, {
      method: 'GET',
    });
    return unwrapData<StoreOrdersPaginated>(res, 'Invalid store orders payload');
  },

  async updateStoreOrderStatus(orderId: string, status: StoreOrderStatus): Promise<StoreOrderAdmin> {
    const res = await apiFetch<ApiResponse<StoreOrderAdmin>>(`/admin/store/orders/${encodeURIComponent(orderId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    return unwrapData<StoreOrderAdmin>(res, 'Invalid store order status payload');
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
