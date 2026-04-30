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
  SecurityOverview,
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
  SubscriberSummary,
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

const USE_API_PROXY = process.env.NEXT_PUBLIC_API_PROXY !== 'false';

const RAW_API_ORIGIN =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL;
const API_ORIGIN = RAW_API_ORIGIN ? normalizeOrigin(RAW_API_ORIGIN) : '';

const API_V1_BASE_URL = USE_API_PROXY
  ? '/api/v1'
  : `${requireOrigin(
      API_ORIGIN,
      '[api] Missing NEXT_PUBLIC_API_URL or NEXT_PUBLIC_BACKEND_URL while NEXT_PUBLIC_API_PROXY=false.'
    )}/api/v1`;

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
let csrfTokenCache: string | null = null;
let csrfHeaderNameCache = 'X-CSRF-Token';

/* ============================================================================
   Error Utilities
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

export function isUnauthorizedError(err: unknown): boolean {
  return isApiError(err) && err.statusCode === 401;
}

export function isForbiddenError(err: unknown): boolean {
  return isApiError(err) && err.statusCode === 403;
}

function getApiStatusCode(err: unknown): number | undefined {
  if (isApiError(err)) return err.statusCode;

  if (isRecord(err)) {
    const raw = err.statusCode ?? err.status ?? err.code;
    const numeric = Number(raw);
    return Number.isFinite(numeric) ? numeric : undefined;
  }

  return undefined;
}

export function isSlugConflictError(err: unknown): boolean {
  const statusCode = getApiStatusCode(err);
  const message = getErrorMessage(err).toLowerCase();

  return (
    statusCode === 409 ||
    ((statusCode === 400 || statusCode === 422) && message.includes('slug')) ||
    message.includes('slug already') ||
    message.includes('slug already in use') ||
    message.includes('duplicate slug') ||
    message.includes('already exists')
  );
}

export function isMfaRequiredError(err: unknown): boolean {
  if (!isApiError(err)) return false;
  if (err.statusCode !== 403) return false;

  const details = err.details;
  if (!isRecord(details)) return false;

  const message = getMessageFromPayload(details)?.toLowerCase() ?? '';
  const code =
    typeof details.code === 'string' ? details.code.toLowerCase() : '';

  return (
    code.includes('mfa') ||
    message.includes('mfa') ||
    message.includes('multi-factor') ||
    message.includes('totp') ||
    message.includes('2fa')
  );
}

export function isPermissionDeniedError(err: unknown): boolean {
  if (!isApiError(err)) return false;
  if (err.statusCode !== 403) return false;
  return !isMfaRequiredError(err);
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
      typeof item.code === 'string' && item.code.trim()
        ? item.code.trim()
        : undefined;

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

function toHeaderRecord(headers?: HeadersInit): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) {
    const out: Record<string, string> = {};
    headers.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }
  if (Array.isArray(headers)) {
    return headers.reduce<Record<string, string>>((acc, [key, value]) => {
      acc[String(key)] = String(value);
      return acc;
    }, {});
  }
  return Object.entries(headers).reduce<Record<string, string>>((acc, [key, value]) => {
    if (typeof value === 'undefined') return acc;
    acc[key] = String(value);
    return acc;
  }, {});
}

function isSafeHttpMethod(method: string): boolean {
  switch (method.toUpperCase()) {
    case 'GET':
    case 'HEAD':
    case 'OPTIONS':
    case 'TRACE':
      return true;
    default:
      return false;
  }
}

function shouldAttachCsrf(endpoint: string, method: string): boolean {
  if (isSafeHttpMethod(method)) return false;

  const normalized = endpoint.trim();
  if (!normalized.startsWith('/')) return false;

  const unauthenticatedPrefixes = [
    '/auth/login',
    '/auth/register',
    '/auth/password-reset',
    '/auth/otp',
    '/otp/',
  ];

  if (unauthenticatedPrefixes.some((prefix) => normalized.startsWith(prefix))) {
    return false;
  }

  return normalized.startsWith('/admin/') || normalized.startsWith('/auth/');
}

function resetCsrfCache(): void {
  csrfTokenCache = null;
  csrfHeaderNameCache = 'X-CSRF-Token';
}

async function requestCsrfFromUrl(
  url: string
): Promise<{ token: string; header: string } | null> {
  const response = await fetch(url, {
    method: 'GET',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403 || response.status === 404) {
      return null;
    }
    const payload =
      (await safeParseJson(response)) ?? {
        message: await response.text().catch(() => ''),
      };
    throw createApiError(
      getMessageFromPayload(payload) || 'Failed to initialize CSRF token',
      response.status,
      payload
    );
  }

  const payload = (await safeParseJson(response)) as unknown;
  const data = isRecord(payload) && isRecord(payload.data) ? payload.data : payload;
  if (!isRecord(data)) return null;

  const token = typeof data.token === 'string' ? data.token.trim() : '';
  const header =
    typeof data.header === 'string' && data.header.trim()
      ? data.header.trim()
      : 'X-CSRF-Token';

  if (!token) return null;
  return { token, header };
}

async function ensureCsrfToken(
  forceRefresh = false
): Promise<{ token: string; header: string }> {
  if (!forceRefresh && csrfTokenCache) {
    return { token: csrfTokenCache, header: csrfHeaderNameCache };
  }

  const proxyUrl = `${API_V1_BASE_URL}/auth/csrf-token`;
  const directUrl = API_ORIGIN ? `${API_ORIGIN}/api/v1/auth/csrf-token` : '';

  let csrf = await requestCsrfFromUrl(proxyUrl);
  if (!csrf && USE_API_PROXY && directUrl) {
    csrf = await requestCsrfFromUrl(directUrl);
  }
  if (!csrf) {
    throw createApiError('Unable to establish CSRF session', 401);
  }

  csrfTokenCache = csrf.token;
  csrfHeaderNameCache = csrf.header;
  return csrf;
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
      row.date ??
      row.day ??
      row.label ??
      row.createdAt ??
      row.created_at;
    const countRaw =
      row.count ??
      row.total ??
      row.value ??
      row.registrations ??
      row.submissions;

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

function sanitizeScalarVisibilityValue(
  value: unknown
): string | number | boolean | undefined {
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
    const fieldKey =
      typeof rawRule.fieldKey === 'string' ? rawRule.fieldKey.trim() : '';
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
            .filter(
              (item): item is string | number | boolean =>
                typeof item !== 'undefined'
            )
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

function sanitizeFormPayload<T extends CreateFormRequest | UpdateFormRequest>(
  payload: T
): T {
  if (!payload || typeof payload !== 'object') return payload;

  const nextPayload = { ...payload } as T;

  if ('settings' in payload && payload.settings) {
    const nextSettings = { ...(payload.settings as Record<string, unknown>) };

    if ('responseEmailTemplateUrl' in nextSettings) {
      const normalized = normalizeAbsoluteHttpUrl(
        nextSettings.responseEmailTemplateUrl
      );
      if (normalized) {
        nextSettings.responseEmailTemplateUrl = normalized;
      } else {
        delete nextSettings.responseEmailTemplateUrl;
      }
    }

    if ('campaignEmailTemplateUrl' in nextSettings) {
      const normalized = normalizeAbsoluteHttpUrl(
        nextSettings.campaignEmailTemplateUrl
      );
      if (normalized) {
        nextSettings.campaignEmailTemplateUrl = normalized;
      } else {
        delete nextSettings.campaignEmailTemplateUrl;
      }
    }

    (nextPayload as T & { settings?: typeof nextSettings }).settings =
      nextSettings;
  }

  if ('fields' in payload && Array.isArray(payload.fields)) {
    (nextPayload as unknown as { fields?: unknown[] }).fields = payload.fields.map(
      (field) => {
        if (!field || typeof field !== 'object') return field;
        const rawField = field as Record<string, unknown>;
        const nextField: Record<string, unknown> = {
          id: typeof rawField.id === 'string' ? rawField.id : undefined,
          key: typeof rawField.key === 'string' ? rawField.key.trim() : undefined,
          label: typeof rawField.label === 'string' ? rawField.label.trim() : rawField.label,
          type: rawField.type,
          required: rawField.required === true,
          order: typeof rawField.order === 'number' ? rawField.order : undefined,
        };

        if (Array.isArray(rawField.options)) {
          nextField.options = rawField.options
            .map((option) => {
              if (!option || typeof option !== 'object') return null;
              const rawOption = option as Record<string, unknown>;
              return {
                label:
                  typeof rawOption.label === 'string'
                    ? rawOption.label.trim()
                    : rawOption.label,
                value:
                  typeof rawOption.value === 'string'
                    ? rawOption.value.trim()
                    : rawOption.value,
              };
            })
            .filter(Boolean);
        }

        if (rawField.validation && typeof rawField.validation === 'object') {
          nextField.validation = rawField.validation;
        }

        const nextVisibility = sanitizeVisibilityShape(rawField.visibility);
        if (nextVisibility) {
          nextField.visibility = nextVisibility;
        }

        return nextField;
      }
    );
  }

  return nextPayload;
}

/* ============================================================================
   Auth Storage
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
  resetCsrfCache();
}

/* ============================================================================
   Fetch Wrappers
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

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const proxyUrl = API_V1_BASE_URL + endpoint;
  const directUrl = API_ORIGIN ? API_ORIGIN + '/api/v1' + endpoint : '';
  const method = String(options.method || 'GET').toUpperCase();
  const isFormData =
    typeof FormData !== 'undefined' && options.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...toHeaderRecord(options.headers),
  };

  const csrfRequired = shouldAttachCsrf(endpoint, method);
  if (csrfRequired) {
    const csrf = await ensureCsrfToken(false);
    headers[csrf.header] = csrf.token;
  }

  const execute = async (
    url: string,
    requestHeaders: HeadersInit
  ): Promise<{ response: Response; payload: unknown }> => {
    const response = await fetch(url, {
      ...options,
      headers: requestHeaders,
      credentials: 'include',
      cache: 'no-store',
    });

    const json = await safeParseJson(response);
    const payload: unknown =
      json ?? { message: await response.text().catch(() => '') };

    return { response, payload };
  };

  try {
    let usedUrl = proxyUrl;
    let { response, payload } = await execute(proxyUrl, headers);

    if (response.status === 404 && USE_API_PROXY && directUrl) {
      usedUrl = directUrl;
      ({ response, payload } = await execute(directUrl, headers));
    }

    if (response.status === 403 && csrfRequired) {
      resetCsrfCache();
      const csrf = await ensureCsrfToken(true);
      const retryHeaders = { ...headers, [csrf.header]: csrf.token };
      ({ response, payload } = await execute(usedUrl, retryHeaders));
    }

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

async function uploadFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  _publicUpload = true
): Promise<T> {
  const proxyUrl = `${UPLOAD_V1_BASE_URL}${endpoint}`;
  const directUrl = UPLOAD_ORIGIN ? `${UPLOAD_ORIGIN}/api/v1${endpoint}` : '';
  const method = String(options.method || 'GET').toUpperCase();
  const isFormData =
    typeof FormData !== 'undefined' && options.body instanceof FormData;

  const baseHeaders: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...toHeaderRecord(options.headers),
  };

  const csrfRequired = shouldAttachCsrf(endpoint, method);

  const execute = async (
    url: string,
    requestHeaders: Record<string, string>
  ): Promise<{ response: Response; payload: unknown }> => {
    const response = await fetch(url, {
      ...options,
      headers: requestHeaders,
      credentials: 'include',
      cache: 'no-store',
    });

    const json = await safeParseJson(response);
    const payload: unknown =
      json ?? { message: await response.text().catch(() => '') };

    return { response, payload };
  };

  try {
    let headers = { ...baseHeaders };

    if (csrfRequired) {
      const csrf = await ensureCsrfToken(false);
      headers[csrf.header] = csrf.token;
    }

    let usedUrl = proxyUrl;
    let { response, payload } = await execute(proxyUrl, headers);

    if (response.status === 404 && USE_API_PROXY && directUrl) {
      usedUrl = directUrl;
      ({ response, payload } = await execute(directUrl, headers));
    }

    if (response.status === 403 && csrfRequired) {
      resetCsrfCache();

      const csrf = await ensureCsrfToken(true);
      headers = { ...baseHeaders, [csrf.header]: csrf.token };

      ({ response, payload } = await execute(usedUrl, headers));
    }

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

function appendOptionalFormValue(
  form: FormData,
  key: string,
  value?: string | null
): void {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (normalized) form.append(key, normalized);
}

function normalizeUploadImageResponse(
  raw: UploadImageResponse
): UploadImageResponse {
  const record = raw as UploadImageResponse & {
    public_url?: string;
    object_key?: string;
    size_bytes?: number;
    original_name?: string;
    content_type?: string;
    mime_type?: string;
  };

  const publicUrl = record.publicUrl || record.public_url || record.url;
  const objectKey = record.objectKey || record.object_key || record.key;

  if (!publicUrl) {
    throw createApiError(
      'Upload succeeded but no public URL was returned',
      400,
      raw
    );
  }

  return {
    ...raw,
    url: publicUrl,
    publicUrl,
    key: objectKey || record.key || publicUrl,
    objectKey: objectKey || record.objectKey,
    contentType: record.contentType || record.content_type,
    mimeType: record.mimeType || record.mime_type,
    sizeBytes: record.sizeBytes ?? record.size_bytes,
    originalName: record.originalName || record.original_name,
  };
}

function unwrapUploadImageResponse(
  res: unknown,
  errorMessage: string
): UploadImageResponse {
  return normalizeUploadImageResponse(
    unwrapData<UploadImageResponse>(res, errorMessage)
  );
}

async function rootFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
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
      cache: 'no-store',
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

function parseApprovalType(
  value: unknown
): 'testimonial' | 'event' | 'admin_user' {
  if (value === 'testimonial' || value === 'event' || value === 'admin_user') {
    return value;
  }
  return 'admin_user';
}

function parseApprovalStatus(
  value: unknown
): 'pending' | 'approved' | 'deleted' {
  if (value === 'pending' || value === 'approved' || value === 'deleted') {
    return value;
  }
  return 'pending';
}

function normalizeApprovalRequest(value: unknown): ApprovalRequest | null {
  if (!isRecord(value)) return null;
  const id = typeof value.id === 'string' ? value.id : '';
  if (!id) return null;

  const createdAt =
    typeof value.createdAt === 'string'
      ? value.createdAt
      : new Date().toISOString();
  const updatedAt =
    typeof value.updatedAt === 'string' ? value.updatedAt : createdAt;

  return {
    id,
    ticketCode: typeof value.ticketCode === 'string' ? value.ticketCode : '',
    type: parseApprovalType(value.type),
    status: parseApprovalStatus(value.status),
    entityId: typeof value.entityId === 'string' ? value.entityId : undefined,
    entityLabel:
      typeof value.entityLabel === 'string' ? value.entityLabel : undefined,
    requestedById:
      typeof value.requestedById === 'string'
        ? value.requestedById
        : undefined,
    requestedByName:
      typeof value.requestedByName === 'string'
        ? value.requestedByName
        : undefined,
    requestedByEmail:
      typeof value.requestedByEmail === 'string'
        ? value.requestedByEmail
        : undefined,
    approvedById:
      typeof value.approvedById === 'string' ? value.approvedById : undefined,
    approvedByName:
      typeof value.approvedByName === 'string'
        ? value.approvedByName
        : undefined,
    approvedByEmail:
      typeof value.approvedByEmail === 'string'
        ? value.approvedByEmail
        : undefined,
    approvedAt:
      typeof value.approvedAt === 'string' ? value.approvedAt : undefined,
    createdAt,
    updatedAt,
  };
}

function normalizeApprovalTimeline(payload: unknown): ApprovalRequestsTimeline {
  const source = isRecord(payload) && isRecord(payload.data) ? payload.data : payload;
  const record = isRecord(source) ? source : {};

  const normalizePoints = (value: unknown): { day: string; count: number }[] => {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => {
        if (!isRecord(item)) return null;
        const day = typeof item.day === 'string' ? item.day : '';
        const rawCount = item.count;
        const count = typeof rawCount === 'number' ? rawCount : Number(rawCount);
        if (!day || Number.isNaN(count)) return null;
        return { day, count };
      })
      .filter((item): item is { day: string; count: number } => item !== null);
  };

  const start = typeof record.start === 'string' ? record.start : '';
  const end = typeof record.end === 'string' ? record.end : '';

  return {
    start,
    end,
    created: normalizePoints(record.created),
    approved: normalizePoints(record.approved),
  };
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
      (meta
        ? toNumber(meta.total) ??
          toNumber(meta.total_items) ??
          toNumber(meta.count)
        : undefined);

    const page = toNumber(record.page) ?? (meta ? toNumber(meta.page) : undefined);
    const limit =
      toNumber(record.limit) ??
      toNumber(record.per_page) ??
      (meta ? toNumber(meta.limit) ?? toNumber(meta.per_page) : undefined);

    const totalPages =
      toNumber(record.totalPages) ??
      toNumber(record.total_pages) ??
      (meta
        ? toNumber(meta.totalPages) ?? toNumber(meta.total_pages)
        : undefined);

    if (!data || total === undefined) return null;

    const safeLimit = limit ?? Math.max(data.length, 1);
    const safePage = page ?? 1;
    const safeTotalPages =
      totalPages ?? Math.max(1, Math.ceil(total / safeLimit));

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
      const inner = build(
        (res as Record<string, unknown>).data as Record<string, unknown>
      );
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
      expires_at:
        typeof d.expires_at === 'string' ? d.expires_at : undefined,
      action_url:
        typeof d.action_url === 'string' ? d.action_url : undefined,
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
    if (k === 'limit') {
      const limit = Number(v);
      if (Number.isFinite(limit)) {
        cleaned[k] = String(Math.max(1, Math.min(100, Math.trunc(limit))));
        continue;
      }
    }
    cleaned[k] = String(v);
  }
  const qs = new URLSearchParams(cleaned).toString();
  return qs ? `?${qs}` : '';
}

/* ============================================================================
   API CLIENT
============================================================================ */

export const apiClient = {
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

  async requestPasswordReset(
    payload: PasswordResetRequestPayload
  ): Promise<SendOTPResponse> {
    const res = await apiFetch<ApiResponse<SendOTPResponse>>(
      '/auth/password-reset/request',
      { method: 'POST', body: JSON.stringify(payload) }
    );
    return unwrapData<SendOTPResponse>(res, 'Invalid password reset response');
  },

  async confirmPasswordReset(
    payload: PasswordResetConfirmPayload
  ): Promise<MessageResponse> {
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
    clearAuthStorage();
  },

  async getCurrentUser(): Promise<User | null> {
    try {
      const res = await apiFetch<ApiResponse<unknown>>('/auth/me', {
        method: 'GET',
      });

      const data =
        isRecord(res) && 'data' in res
          ? (res as { data?: unknown }).data
          : undefined;

      if (data == null) {
        return null;
      }

      try {
        return extractUser(res);
      } catch {
        return isUserLike(data) ? (data as User) : null;
      }
    } catch (err) {
      if (isUnauthorizedError(err) || isForbiddenError(err)) {
        return null;
      }
      throw err;
    }
  },

  async getCsrfToken(): Promise<{ token: string; header: string }> {
    return ensureCsrfToken(false);
  },

  async getMFASecurityProfile(): Promise<AuthSecurityProfile | null> {
    try {
      const res = await apiFetch<ApiResponse<AuthSecurityProfile>>('/auth/mfa', {
        method: 'GET',
      });
      return unwrapData<AuthSecurityProfile>(
        res,
        'Invalid MFA security profile payload'
      );
    } catch (err) {
      if (isUnauthorizedError(err)) {
        return null;
      }
      throw err;
    }
  },

  async beginTotpSetup(): Promise<TOTPSetupResponse> {
    const res = await apiFetch<ApiResponse<TOTPSetupResponse>>(
      '/auth/mfa/totp/setup',
      {
        method: 'POST',
      }
    );
    return unwrapData<TOTPSetupResponse>(
      res,
      'Invalid authenticator setup payload'
    );
  },

  async enableTotp(code: string): Promise<AuthSecurityProfile> {
    const res = await apiFetch<ApiResponse<AuthSecurityProfile>>(
      '/auth/mfa/totp/enable',
      {
        method: 'POST',
        body: JSON.stringify({ code }),
      }
    );
    return unwrapData<AuthSecurityProfile>(
      res,
      'Invalid authenticator enable payload'
    );
  },

  async disableTotp(code: string): Promise<AuthSecurityProfile> {
    const res = await apiFetch<ApiResponse<AuthSecurityProfile>>(
      '/auth/mfa/totp/disable',
      {
        method: 'POST',
        body: JSON.stringify({ code }),
      }
    );
    return unwrapData<AuthSecurityProfile>(
      res,
      'Invalid authenticator disable payload'
    );
  },

  async setPreferredMfaMethod(method: MFAMethod): Promise<AuthSecurityProfile> {
    const res = await apiFetch<ApiResponse<AuthSecurityProfile>>(
      '/auth/mfa/method',
      {
        method: 'PATCH',
        body: JSON.stringify({ method }),
      }
    );
    return unwrapData<AuthSecurityProfile>(
      res,
      'Invalid MFA preference payload'
    );
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

  healthCheck(): Promise<HealthCheckResponse> {
    return rootFetch('/healthz', { method: 'GET' });
  },

  async getAllTestimonials(params?: { approved?: boolean }): Promise<Testimonial[]> {
    if (params?.approved === false) {
      const res = await apiFetch<ApiResponse<Testimonial[]>>(
        '/admin/testimonials/pending'
      );
      return unwrapData<Testimonial[]>(res, 'Invalid testimonials payload');
    }

    const qs =
      params?.approved !== undefined ? `?approved=${params.approved}` : '';
    const res = await apiFetch<ApiResponse<Testimonial[]>>(
      `/testimonials/all${qs}`
    );
    return unwrapData<Testimonial[]>(res, 'Invalid testimonials payload');
  },

  getPaginatedTestimonials(
    params?: Record<string, string>
  ): Promise<PaginatedResponse<Testimonial>> {
    const qs = params ? `?${new URLSearchParams(params)}` : '';
    return apiFetch(`/testimonials${qs}`);
  },

  async getTestimonialById(id: string): Promise<Testimonial> {
    const res = await apiFetch<ApiResponse<Testimonial>>(
      `/testimonials/${encodeURIComponent(id)}`
    );
    return unwrapData<Testimonial>(res, 'Invalid testimonial payload');
  },

  async createTestimonial(data: CreateTestimonialData): Promise<Testimonial> {
    const res = await apiFetch<ApiResponse<Testimonial>>('/testimonials', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return unwrapData<Testimonial>(res, 'Invalid testimonial payload');
  },

  async updateTestimonial(
    id: string,
    data: UpdateTestimonialData
  ): Promise<Testimonial> {
    const res = await apiFetch<ApiResponse<Testimonial>>(
      `/admin/testimonials/${encodeURIComponent(id)}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    );
    return unwrapData<Testimonial>(res, 'Invalid testimonial payload');
  },

  deleteTestimonial(id: string) {
    return apiFetch(`/admin/testimonials/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  approveTestimonial(id: string) {
    return apiFetch(`/admin/testimonials/${encodeURIComponent(id)}/approve`, {
      method: 'PATCH',
    });
  },

  async getDashboardStats(): Promise<Record<string, unknown>> {
    const res = await apiFetch<ApiResponse<unknown>>('/admin/dashboard');
    return unwrapData<Record<string, unknown>>(res, 'Invalid dashboard stats');
  },

  async getSecurityOverview(): Promise<SecurityOverview> {
    const res = await apiFetch<ApiResponse<SecurityOverview>>(
      '/admin/security/overview'
    );
    return unwrapData<SecurityOverview>(
      res,
      'Invalid security overview payload'
    );
  },

  getAllUsers(params?: Record<string, string>) {
    const qs = params ? `?${new URLSearchParams(params)}` : '';
    return apiFetch(`/admin/users${qs}`);
  },

  approveAdminUser(id: string): Promise<MessageResponse> {
    return apiFetch(`/admin/users/${encodeURIComponent(id)}/approve`, {
      method: 'POST',
    });
  },

  async getAnalytics(
    params?: Record<string, unknown>
  ): Promise<DashboardAnalytics> {
    const qs = toQueryString(params);
    const res = await apiFetch<ApiResponse<DashboardAnalytics>>(
      `/admin/analytics${qs}`,
      { method: 'GET' }
    );
    return unwrapData<DashboardAnalytics>(res, 'Invalid analytics payload');
  },

  async getEvents(
    params?: Record<string, unknown>
  ): Promise<SimplePaginatedResponse<EventData>> {
    const qs = toQueryString(params);
    const res = await apiFetch(`/admin/events${qs}`, { method: 'GET' });
    return unwrapSimplePaginated<EventData>(res, 'Invalid events payload');
  },

  async getEvent(id: string): Promise<EventData> {
    const res = await apiFetch<{ data: EventData }>(
      `/events/${encodeURIComponent(id)}`,
      { method: 'GET' }
    );
    return unwrapData<EventData>(res, 'Invalid event payload');
  },

  async getAdminEvent(id: string): Promise<EventData> {
    const res = await apiFetch<{ data: EventData }>(
      `/admin/events/${encodeURIComponent(id)}`,
      { method: 'GET' }
    );
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
    const res = await apiFetch<{ data: EventData }>(
      `/admin/events/${encodeURIComponent(id)}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    );
    return unwrapData<EventData>(res, 'Invalid event payload');
  },

  async deleteEvent(id: string): Promise<MessageResponse> {
    return apiFetch(`/admin/events/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  async approveEvent(id: string): Promise<MessageResponse> {
    return apiFetch(`/admin/events/${encodeURIComponent(id)}/approve`, {
      method: 'PATCH',
    });
  },

  async uploadEventImage(id: string, file: File): Promise<EventData> {
    const form = new FormData();
    form.append('file', file);
    const res = await uploadFetch<{ data: EventData }>(
      `/admin/events/${encodeURIComponent(id)}/image`,
      {
        method: 'POST',
        body: form,
      }
    );
    return unwrapData<EventData>(res, 'Invalid upload image payload');
  },

  async uploadEventBanner(id: string, file: File): Promise<EventData> {
    const form = new FormData();
    form.append('file', file);
    const res = await uploadFetch<{ data: EventData }>(
      `/admin/events/${encodeURIComponent(id)}/banner`,
      {
        method: 'POST',
        body: form,
      }
    );
    return unwrapData<EventData>(res, 'Invalid upload banner payload');
  },

  async getReels(
    params?: Record<string, unknown>
  ): Promise<SimplePaginatedResponse<ReelData>> {
    const qs = toQueryString(params);
    const res = await apiFetch(`/admin/reels${qs}`, { method: 'GET' });
    return unwrapSimplePaginated<ReelData>(res, 'Invalid reels payload');
  },

  async createReel(payload: CreateReelData): Promise<ReelData> {
    const res = await apiFetch<{ data: ReelData }>('/admin/reels', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return unwrapData<ReelData>(res, 'Invalid reel payload');
  },

  async deleteReel(id: string): Promise<MessageResponse> {
    return apiFetch(`/admin/reels/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  async createUploadPresign(
    payload: UploadPresignRequest
  ): Promise<UploadPresignResponse> {
    const normalizedPayload: UploadPresignRequest = {
      ...payload,
      sizeBytes: payload.sizeBytes ?? payload.size,
    };
    const res = await apiFetch<{ data: UploadPresignResponse }>(
      '/admin/uploads/presign',
      {
        method: 'POST',
        body: JSON.stringify(normalizedPayload),
      }
    );
    return unwrapData<UploadPresignResponse>(
      res,
      'Invalid upload presign payload'
    );
  },

  async completeUploadAsset(assetId: string): Promise<UploadAssetData> {
    const res = await apiFetch<{ data: UploadAssetData }>(
      `/admin/uploads/${encodeURIComponent(assetId)}/complete`,
      { method: 'POST' }
    );
    return unwrapData<UploadAssetData>(
      res,
      'Invalid upload completion payload'
    );
  },

  async uploadAsset(
    file: File,
    options?: {
      kind?: 'image' | 'video' | 'audio' | 'document' | 'file';
      module?: string;
      folder?: string;
      ownerType?: string;
      ownerId?: string;
    }
  ): Promise<UploadImageResponse> {
    const form = new FormData();
    form.append('file', file);
    form.append('kind', options?.kind || 'file');
    form.append('module', options?.module || 'uploads');
    appendOptionalFormValue(form, 'folder', options?.folder);
    appendOptionalFormValue(form, 'ownerType', options?.ownerType);
    appendOptionalFormValue(form, 'ownerId', options?.ownerId);

    const res = await uploadFetch<{ data: UploadImageResponse }>(
      '/uploads',
      { method: 'POST', body: form }
    );

    return unwrapUploadImageResponse(res, 'Invalid upload asset payload');
  },

  async uploadPublicLeadershipImage(file: File): Promise<UploadImageResponse> {
    const form = new FormData();
    form.append('file', file);
    form.append('kind', 'image');
    form.append('module', 'public-forms');
    form.append('ownerType', 'public-form');
    form.append('folder', 'public-forms/images');

    const res = await uploadFetch<{ data: UploadImageResponse }>(
      '/uploads/images',
      {
        method: 'POST',
        body: form,
      }
    );

    return unwrapData<UploadImageResponse>(res, 'Invalid public image upload payload');
  },

  async uploadImage(file: File, folder = 'uploads'): Promise<UploadImageResponse> {
    const form = new FormData();
    form.append('file', file);
    form.append('folder', folder);
    const res = await uploadFetch<{ data: UploadImageResponse }>(
      '/admin/uploads/images',
      {
        method: 'POST',
        body: form,
      }
    );
    return unwrapUploadImageResponse(res, 'Invalid image upload payload');
  },

  async createAdminEmailTemplate(
    payload: CreateEmailTemplateRequest
  ): Promise<EmailTemplate> {
    const res = await apiFetch<{ data: EmailTemplate }>(
      '/admin/email/templates',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
    return unwrapData<EmailTemplate>(res, 'Invalid email template payload');
  },

  async listAdminEmailTemplates(
    params?: Record<string, unknown>
  ): Promise<SimplePaginatedResponse<EmailTemplate>> {
    const qs = toQueryString(params);
    const res = await apiFetch(`/admin/email/templates${qs}`, { method: 'GET' });
    return unwrapSimplePaginated<EmailTemplate>(
      res,
      'Invalid email templates payload'
    );
  },

  async getAdminEmailTemplate(id: string): Promise<EmailTemplate> {
    const res = await apiFetch<{ data: EmailTemplate }>(
      `/admin/email/templates/${encodeURIComponent(id)}`,
      {
        method: 'GET',
      }
    );
    return unwrapData<EmailTemplate>(res, 'Invalid email template payload');
  },

  async updateAdminEmailTemplate(
    id: string,
    payload: UpdateEmailTemplateRequest
  ): Promise<EmailTemplate> {
    const res = await apiFetch<{ data: EmailTemplate }>(
      `/admin/email/templates/${encodeURIComponent(id)}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      }
    );
    return unwrapData<EmailTemplate>(res, 'Invalid email template payload');
  },

  async activateAdminEmailTemplate(id: string): Promise<EmailTemplate> {
    const res = await apiFetch<{ data: EmailTemplate }>(
      `/admin/email/templates/${encodeURIComponent(id)}/activate`,
      { method: 'POST' }
    );
    return unwrapData<EmailTemplate>(res, 'Invalid email template payload');
  },

  async getAdminForms(
    params?: Record<string, unknown>
  ): Promise<SimplePaginatedResponse<AdminForm>> {
    const qs = toQueryString(params);
    const res = await apiFetch(`/admin/forms${qs}`, { method: 'GET' });
    return unwrapSimplePaginated<AdminForm>(res, 'Invalid forms payload');
  },

  async getAdminForm(id: string): Promise<AdminForm> {
    const res = await apiFetch<{ data: AdminForm }>(
      `/admin/forms/${encodeURIComponent(id)}`,
      { method: 'GET' }
    );
    return unwrapData<AdminForm>(res, 'Invalid form payload');
  },

  async createAdminForm(payload: CreateFormRequest): Promise<AdminForm> {
    const sanitizedPayload = sanitizeFormPayload(payload);

    try {
      const res = await apiFetch<{ data: AdminForm }>('/admin/forms', {
        method: 'POST',
        body: JSON.stringify(sanitizedPayload),
      });

      return unwrapData<AdminForm>(res, 'Invalid form payload');
    } catch (err) {
      if (isSlugConflictError(err)) {
        throw createApiError(
          'slug already in use',
          getApiStatusCode(err) ?? 409,
          err,
          [
            {
              field: 'slug',
              code: 'duplicate',
              message: 'This form link name is already in use.',
            },
          ]
        );
      }

      throw err;
    }
  },

  async updateAdminForm(
    id: string,
    payload: UpdateFormRequest
  ): Promise<AdminForm> {
    const sanitizedPayload = sanitizeFormPayload(payload);
    const res = await apiFetch<{ data: AdminForm }>(
      `/admin/forms/${encodeURIComponent(id)}`,
      {
        method: 'PUT',
        body: JSON.stringify(sanitizedPayload),
      }
    );
    return unwrapData<AdminForm>(res, 'Invalid form payload');
  },

  async uploadFormBanner(id: string, file: File): Promise<AdminForm> {
    const form = new FormData();
    form.append('file', file);
    const res = await uploadFetch<{ data: AdminForm }>(
      `/admin/forms/${encodeURIComponent(id)}/banner`,
      {
        method: 'POST',
        body: form,
      }
    );
    return unwrapData<AdminForm>(res, 'Invalid upload banner payload');
  },

  async deleteAdminForm(id: string): Promise<MessageResponse> {
    return apiFetch(`/admin/forms/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  async publishAdminForm(
    id: string
  ): Promise<{
    slug: string;
    publicUrl?: string;
    publishedAt?: string;
    status?: FormStatus;
  }> {
    const res = await apiFetch<{
      data: {
        slug: string;
        publicUrl?: string;
        publishedAt?: string;
        status?: FormStatus;
      };
    }>(`/admin/forms/${encodeURIComponent(id)}/publish`, {
      method: 'POST',
    });

    return unwrapData<{
      slug: string;
      publicUrl?: string;
      publishedAt?: string;
      status?: FormStatus;
    }>(res, 'Invalid publish payload');
  },

  async getAdminFormReportLink(id: string): Promise<FormReportLinkPayload> {
    const res = await apiFetch<ApiResponse<FormReportLinkPayload>>(
      `/admin/forms/${encodeURIComponent(id)}/report-link`,
      { method: 'GET' }
    );
    return unwrapData<FormReportLinkPayload>(
      res,
      'Invalid report link payload'
    );
  },

  async getFormSubmissions(
    id: string,
    params?: Record<string, unknown>
  ): Promise<SimplePaginatedResponse<FormSubmission>> {
    const qs = toQueryString(params);
    const res = await apiFetch(
      `/admin/forms/${encodeURIComponent(id)}/submissions${qs}`,
      { method: 'GET' }
    );
    return unwrapSimplePaginated<FormSubmission>(
      res,
      'Invalid submissions payload'
    );
  },

  async deleteFormSubmission(id: string): Promise<MessageResponse> {
    return apiFetch(`/admin/form-submissions/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  async getFormSubmissionStats(id: string): Promise<FormSubmissionDailyStat[]> {
    const res = await apiFetch<unknown>(
      `/admin/forms/${encodeURIComponent(id)}/submissions/stats`,
      { method: 'GET' }
    );
    return normalizeDailyStats(res);
  },

  async getFormStats(
    params?: Record<string, unknown>
  ): Promise<FormStatsResponse> {
    const qs = toQueryString(params);
    const res = await apiFetch<ApiResponse<FormStatsResponse>>(
      `/admin/forms/stats${qs}`,
      { method: 'GET' }
    );
    return unwrapData<FormStatsResponse>(res, 'Invalid form stats payload');
  },

  async getEmailMarketingSummary(): Promise<AdminEmailMarketingSummary> {
    const res = await apiFetch<ApiResponse<AdminEmailMarketingSummary>>(
      '/admin/email/marketing/summary',
      { method: 'GET' }
    );
    return unwrapData<AdminEmailMarketingSummary>(
      res,
      'Invalid email marketing summary payload'
    );
  },

  async listEmailMarketingForms(
    params?: Record<string, unknown>
  ): Promise<SimplePaginatedResponse<AdminEmailMarketingFormItem>> {
    const qs = toQueryString(params);
    const res = await apiFetch(`/admin/email/marketing/forms${qs}`, {
      method: 'GET',
    });
    return unwrapSimplePaginated<AdminEmailMarketingFormItem>(
      res,
      'Invalid email marketing forms payload'
    );
  },

  async previewEmailMarketingAudience(
    formIds: string[],
    limit = 25
  ): Promise<AdminEmailAudiencePreview> {
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
    return unwrapData<AdminEmailAudiencePreview>(
      res,
      'Invalid email marketing audience preview payload'
    );
  },

  async sendAdminComposeEmail(
    payload: SendAdminComposeEmailRequest
  ): Promise<SendAdminComposeEmailResponse> {
    const res = await apiFetch<ApiResponse<SendAdminComposeEmailResponse>>(
      '/admin/email/compose/send',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
    return unwrapData<SendAdminComposeEmailResponse>(
      res,
      'Invalid admin compose email payload'
    );
  },

  async listAdminComposeHistory(
    params?: Record<string, unknown>
  ): Promise<SimplePaginatedResponse<AdminEmailDeliveryHistoryItem>> {
    const qs = toQueryString(params);
    const res = await apiFetch(`/admin/email/compose/history${qs}`, {
      method: 'GET',
    });
    return unwrapSimplePaginated<AdminEmailDeliveryHistoryItem>(
      res,
      'Invalid admin compose history payload'
    );
  },

  async getPublicForm(slug: string): Promise<PublicFormPayload> {
    const res = await apiFetch<{ data: PublicFormPayload }>(
      `/forms/${encodeURIComponent(slug)}`,
      { method: 'GET' }
    );
    return unwrapData<PublicFormPayload>(res, 'Invalid public form payload');
  },

  async submitPublicForm(
    slug: string,
    payload: SubmitFormRequest | FormData
  ): Promise<MessageResponse> {
    const body = payload instanceof FormData ? payload : JSON.stringify(payload);
    return apiFetch(`/forms/${encodeURIComponent(slug)}/submissions`, {
      method: 'POST',
      body,
    });
  },

  async subscribe(payload: SubscribeRequest): Promise<Subscriber> {
    const res = await apiFetch<ApiResponse<Subscriber>>(
      '/notifications/subscribe',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
    return unwrapData<Subscriber>(res, 'Invalid subscriber payload');
  },

  async unsubscribe(payload: UnsubscribeRequest): Promise<MessageResponse> {
    return apiFetch('/notifications/unsubscribe', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async listSubscribers(
    params?: Record<string, unknown>
  ): Promise<SimplePaginatedResponse<Subscriber>> {
    const qs = toQueryString(params);
    const res = await apiFetch(`/admin/notifications/subscribers${qs}`, {
      method: 'GET',
    });
    return unwrapSimplePaginated<Subscriber>(res, 'Invalid subscribers payload');
  },

  async getSubscriberSummary(): Promise<SubscriberSummary> {
    const res = await apiFetch<ApiResponse<SubscriberSummary>>(
      '/admin/notifications/subscribers/summary',
      {
        method: 'GET',
      }
    );
    return unwrapData<SubscriberSummary>(
      res,
      'Invalid subscriber summary payload'
    );
  },

  async sendNotification(
    payload: SendNotificationRequest
  ): Promise<SendNotificationResult> {
    const res = await apiFetch<ApiResponse<SendNotificationResult>>(
      '/admin/notifications/send',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
    return unwrapData<SendNotificationResult>(
      res,
      'Invalid notification payload'
    );
  },

  async listAdminNotifications(limit = 50): Promise<AdminNotificationInbox> {
    const res = await apiFetch<ApiResponse<AdminNotificationInbox>>(
      `/admin/notifications/inbox?limit=${encodeURIComponent(String(limit))}`,
      { method: 'GET' }
    );
    return unwrapData<AdminNotificationInbox>(
      res,
      'Invalid admin notifications payload'
    );
  },

  async markAdminNotificationRead(id: string): Promise<MessageResponse> {
    return apiFetch(`/admin/notifications/${encodeURIComponent(id)}/read`, {
      method: 'PATCH',
    });
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
    const res = await apiFetch<ApiResponse<ApprovalRequest[]> | ApprovalRequest[]>(
      `/admin/requests${qs}`,
      { method: 'GET' }
    );

    const source = Array.isArray(res)
      ? res
      : isRecord(res) && Array.isArray(res.data)
      ? res.data
      : [];

    return source
      .map(normalizeApprovalRequest)
      .filter((item): item is ApprovalRequest => item !== null);
  },

  async getApprovalRequestsTimeline(days = 14): Promise<ApprovalRequestsTimeline> {
    const res = await apiFetch<
      ApiResponse<ApprovalRequestsTimeline> | ApprovalRequestsTimeline
    >(`/admin/requests/timeline?days=${encodeURIComponent(String(days))}`, {
      method: 'GET',
    });
    return normalizeApprovalTimeline(res);
  },

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

  async getHomepageAdContent(): Promise<HomepageAdContent> {
    const res = await apiFetch<ApiResponse<HomepageAdContent>>(
      '/admin/content/homepage-ad',
      { method: 'GET' }
    );
    return unwrapData<HomepageAdContent>(
      res,
      'Invalid homepage ad content payload'
    );
  },

  async updateHomepageAdContent(
    payload: HomepageAdContent
  ): Promise<HomepageAdContent> {
    const res = await apiFetch<ApiResponse<HomepageAdContent>>(
      '/admin/content/homepage-ad',
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      }
    );
    return unwrapData<HomepageAdContent>(
      res,
      'Invalid homepage ad content payload'
    );
  },

  async getConfessionPopupContent(): Promise<ConfessionPopupContent> {
    const res = await apiFetch<ApiResponse<ConfessionPopupContent>>(
      '/admin/content/confession-popup',
      { method: 'GET' }
    );
    return unwrapData<ConfessionPopupContent>(
      res,
      'Invalid confession popup content payload'
    );
  },

  async updateConfessionPopupContent(
    payload: ConfessionPopupContent
  ): Promise<ConfessionPopupContent> {
    const res = await apiFetch<ApiResponse<ConfessionPopupContent>>(
      '/admin/content/confession-popup',
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      }
    );
    return unwrapData<ConfessionPopupContent>(
      res,
      'Invalid confession popup content payload'
    );
  },

  async listPastoralCareRequests(
    params?: Record<string, unknown>
  ): Promise<SimplePaginatedResponse<PastoralCareRequestAdmin>> {
    const qs = toQueryString(params);
    const res = await apiFetch(`/admin/pastoral-care/requests${qs}`, {
      method: 'GET',
    });
    return unwrapSimplePaginated<PastoralCareRequestAdmin>(
      res,
      'Invalid pastoral care requests payload'
    );
  },

  async listGivingIntents(
    params?: Record<string, unknown>
  ): Promise<SimplePaginatedResponse<GivingIntentAdmin>> {
    const qs = toQueryString(params);
    const res = await apiFetch(`/admin/giving/intents${qs}`, {
      method: 'GET',
    });
    return unwrapSimplePaginated<GivingIntentAdmin>(
      res,
      'Invalid giving intents payload'
    );
  },

  async listWorkforce(
    params?: Record<string, unknown>
  ): Promise<SimplePaginatedResponse<WorkforceMember>> {
    const qs = toQueryString(params);
    const res = await apiFetch(`/admin/workforce${qs}`, { method: 'GET' });
    return unwrapSimplePaginated<WorkforceMember>(
      res,
      'Invalid workforce payload'
    );
  },

  async createWorkforce(
    payload: CreateWorkforceRequest
  ): Promise<WorkforceMember> {
    const res = await apiFetch<ApiResponse<WorkforceMember>>(
      '/admin/workforce',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
    return unwrapData<WorkforceMember>(res, 'Invalid workforce payload');
  },

  async updateWorkforce(
    id: string,
    payload: UpdateWorkforceRequest
  ): Promise<WorkforceMember> {
    const res = await apiFetch<ApiResponse<WorkforceMember>>(
      `/admin/workforce/${encodeURIComponent(id)}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      }
    );
    return unwrapData<WorkforceMember>(res, 'Invalid workforce payload');
  },

  async approveWorkforce(
    id: string,
    payload?: Record<string, unknown>
  ): Promise<WorkforceMember> {
    const res = await apiFetch<ApiResponse<WorkforceMember>>(
      `/admin/workforce/${encodeURIComponent(id)}/approve`,
      {
        method: 'POST',
        body: JSON.stringify(payload || {}),
      }
    );
    return unwrapData<WorkforceMember>(res, 'Invalid workforce payload');
  },

  async applyToWorkforce(
    payload: CreateWorkforceRequest
  ): Promise<WorkforceMember> {
    const res = await apiFetch<ApiResponse<WorkforceMember>>(
      '/workforce/apply',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
    return unwrapData<WorkforceMember>(res, 'Invalid workforce payload');
  },

  async getWorkforceStats(): Promise<WorkforceStatsResponse> {
    const res = await apiFetch<ApiResponse<WorkforceStatsResponse>>(
      '/admin/workforce/stats',
      { method: 'GET' }
    );
    return unwrapData<WorkforceStatsResponse>(
      res,
      'Invalid workforce stats payload'
    );
  },

  async listMembers(
    params?: Record<string, unknown>
  ): Promise<SimplePaginatedResponse<Member>> {
    const qs = toQueryString(params);

    try {
      const res = await apiFetch(`/admin/members${qs}`, { method: 'GET' });
      return unwrapSimplePaginated<Member>(res, 'Invalid members payload');
    } catch (error) {
      console.error('[api] listMembers failed:', error);

      return {
        data: [],
        total: 0,
        page: Number(params?.page || 1),
        limit: Number(params?.limit || 100),
        totalPages: 1,
      };
    }
  },

  async createMember(payload: CreateMemberRequest): Promise<Member> {
    const res = await apiFetch<ApiResponse<Member>>('/admin/members', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return unwrapData<Member>(res, 'Invalid member payload');
  },

  async updateMember(
    id: string,
    payload: UpdateMemberRequest
  ): Promise<Member> {
    const res = await apiFetch<ApiResponse<Member>>(
      `/admin/members/${encodeURIComponent(id)}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      }
    );
    return unwrapData<Member>(res, 'Invalid member payload');
  },

  async deleteMember(id: string): Promise<MessageResponse> {
    return apiFetch(`/admin/members/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  async listLeadership(
    params?: Record<string, unknown>
  ): Promise<SimplePaginatedResponse<LeadershipMember>> {
    const qs = toQueryString(params);

    try {
      const res = await apiFetch(`/admin/leadership${qs}`, { method: 'GET' });
      return unwrapSimplePaginated<LeadershipMember>(
        res,
        'Invalid leadership payload'
      );
    } catch (error) {
      console.error('[api] listLeadership failed:', error);

      return {
        data: [],
        total: 0,
        page: Number(params?.page || 1),
        limit: Number(params?.limit || 100),
        totalPages: 1,
      };
    }
  },

  async createLeadership(
    payload: CreateLeadershipRequest
  ): Promise<LeadershipMember> {
    const res = await apiFetch<ApiResponse<LeadershipMember>>(
      '/admin/leadership',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
    return unwrapData<LeadershipMember>(res, 'Invalid leadership payload');
  },

  async updateLeadership(
    id: string,
    payload: UpdateLeadershipRequest
  ): Promise<LeadershipMember> {
    const res = await apiFetch<ApiResponse<LeadershipMember>>(
      `/admin/leadership/${encodeURIComponent(id)}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      }
    );
    return unwrapData<LeadershipMember>(res, 'Invalid leadership payload');
  },

  async deleteLeadership(id: string): Promise<MessageResponse> {
    return apiFetch(`/admin/leadership/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  async approveLeadership(id: string): Promise<LeadershipMember> {
    const res = await apiFetch<ApiResponse<LeadershipMember>>(
      `/admin/leadership/${encodeURIComponent(id)}/approve`,
      {
        method: 'POST',
      }
    );
    return unwrapData<LeadershipMember>(
      res,
      'Invalid leadership approval payload'
    );
  },

  async declineLeadership(id: string): Promise<LeadershipMember> {
    const res = await apiFetch<ApiResponse<LeadershipMember>>(
      `/admin/leadership/${encodeURIComponent(id)}/decline`,
      {
        method: 'POST',
      }
    );
    return unwrapData<LeadershipMember>(
      res,
      'Invalid leadership decline payload'
    );
  },

  async listStoreProductsAdmin(includeInactive = true): Promise<StoreProductAdmin[]> {
    const qs = toQueryString({ includeInactive });
    const res = await apiFetch<ApiResponse<StoreProductAdmin[]> | StoreProductAdmin[]>(
      `/admin/store/products${qs}`,
      {
        method: 'GET',
      }
    );
    if (Array.isArray(res)) return res;
    const payload = unwrapData<unknown>(res, 'Invalid store products payload');
    if (Array.isArray(payload)) return payload as StoreProductAdmin[];
    if (isRecord(payload) && Array.isArray(payload.data)) {
      return payload.data as StoreProductAdmin[];
    }
    return [];
  },

  async createStoreProduct(
    payload: UpsertStoreProductRequest
  ): Promise<StoreProductAdmin> {
    const res = await apiFetch<ApiResponse<StoreProductAdmin>>(
      '/admin/store/products',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
    return unwrapData<StoreProductAdmin>(res, 'Invalid store product payload');
  },

  async updateStoreProduct(
    id: number,
    payload: UpsertStoreProductRequest
  ): Promise<StoreProductAdmin> {
    const res = await apiFetch<ApiResponse<StoreProductAdmin>>(
      `/admin/store/products/${encodeURIComponent(String(id))}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      }
    );
    return unwrapData<StoreProductAdmin>(res, 'Invalid store product payload');
  },

  async updateStoreProductStock(
    id: number,
    stock: number
  ): Promise<StoreProductAdmin> {
    const res = await apiFetch<ApiResponse<StoreProductAdmin>>(
      `/admin/store/products/${encodeURIComponent(String(id))}/stock`,
      {
        method: 'PATCH',
        body: JSON.stringify({ stock }),
      }
    );
    return unwrapData<StoreProductAdmin>(
      res,
      'Invalid store stock payload'
    );
  },

  async updateStoreProductActive(
    id: number,
    isActive: boolean
  ): Promise<StoreProductAdmin> {
    const res = await apiFetch<ApiResponse<StoreProductAdmin>>(
      `/admin/store/products/${encodeURIComponent(String(id))}/active`,
      {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
      }
    );
    return unwrapData<StoreProductAdmin>(
      res,
      'Invalid store product active payload'
    );
  },

  async listStoreOrders(params?: {
    page?: number;
    limit?: number;
    status?: StoreOrderStatus | '';
  }): Promise<StoreOrdersPaginated> {
    const qs = toQueryString(params || {});
    const res = await apiFetch<ApiResponse<StoreOrdersPaginated> | StoreOrdersPaginated>(
      `/admin/store/orders${qs}`,
      {
        method: 'GET',
      }
    );
    return unwrapData<StoreOrdersPaginated>(res, 'Invalid store orders payload');
  },

  async updateStoreOrderStatus(
    orderId: string,
    status: StoreOrderStatus
  ): Promise<StoreOrderAdmin> {
    const res = await apiFetch<ApiResponse<StoreOrderAdmin>>(
      `/admin/store/orders/${encodeURIComponent(orderId)}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }
    );
    return unwrapData<StoreOrderAdmin>(
      res,
      'Invalid store order status payload'
    );
  },

  async getWorkforceBirthdayStats(): Promise<Record<string, unknown>> {
    const res = await apiFetch<ApiResponse<Record<string, unknown>>>(
      '/admin/workforce/birthdays/stats',
      {
        method: 'GET',
      }
    );
    return unwrapData<Record<string, unknown>>(
      res,
      'Invalid birthday stats payload'
    );
  },

  async getWorkforceBirthdaysByMonth(month: number): Promise<WorkforceMember[]> {
    const res = await apiFetch<ApiResponse<unknown> | WorkforceMember[]>(
      `/admin/workforce/birthdays/month/${encodeURIComponent(String(month))}`,
      { method: 'GET' }
    );
    if (Array.isArray(res)) return res;
    const payload = unwrapData<unknown>(
      res,
      'Invalid birthdays by month payload'
    );
    if (Array.isArray(payload)) return payload as WorkforceMember[];
    if (isRecord(payload) && Array.isArray(payload.data)) {
      return payload.data as WorkforceMember[];
    }
    return [];
  },

  async getWorkforceBirthdaysToday(): Promise<WorkforceMember[]> {
    const res = await apiFetch<ApiResponse<unknown> | WorkforceMember[]>(
      '/admin/workforce/birthdays/today',
      { method: 'GET' }
    );
    if (Array.isArray(res)) return res;
    const payload = unwrapData<unknown>(res, 'Invalid birthdays today payload');
    if (Array.isArray(payload)) return payload as WorkforceMember[];
    if (isRecord(payload) && Array.isArray(payload.data)) {
      return payload.data as WorkforceMember[];
    }
    return [];
  },

  async sendWorkforceBirthdaysToday(): Promise<Record<string, number>> {
    const res = await apiFetch<ApiResponse<Record<string, number>>>(
      '/admin/workforce/birthdays/send-today',
      {
        method: 'POST',
      }
    );
    return unwrapData<Record<string, number>>(
      res,
      'Invalid birthday send payload'
    );
  },

  async getMemberBirthdaysByMonth(month: number): Promise<Member[]> {
    const res = await apiFetch<ApiResponse<unknown> | Member[]>(
      `/admin/members/birthdays/month/${encodeURIComponent(String(month))}`,
      { method: 'GET' }
    );
    if (Array.isArray(res)) return res;
    const payload = unwrapData<unknown>(
      res,
      'Invalid member birthdays by month payload'
    );
    if (Array.isArray(payload)) return payload as Member[];
    if (isRecord(payload) && Array.isArray(payload.data)) {
      return payload.data as Member[];
    }
    return [];
  },

  async getLeadershipBirthdaysByMonth(
    month: number
  ): Promise<LeadershipMember[]> {
    const res = await apiFetch<ApiResponse<unknown> | LeadershipMember[]>(
      `/admin/leadership/birthdays/month/${encodeURIComponent(String(month))}`,
      { method: 'GET' }
    );
    if (Array.isArray(res)) return res;
    const payload = unwrapData<unknown>(
      res,
      'Invalid leadership birthdays by month payload'
    );
    if (Array.isArray(payload)) return payload as LeadershipMember[];
    if (isRecord(payload) && Array.isArray(payload.data)) {
      return payload.data as LeadershipMember[];
    }
    return [];
  },

  async getLeadershipAnniversariesByMonth(
    month: number
  ): Promise<LeadershipMember[]> {
    const res = await apiFetch<ApiResponse<unknown> | LeadershipMember[]>(
      `/admin/leadership/anniversaries/month/${encodeURIComponent(
        String(month)
      )}`,
      { method: 'GET' }
    );
    if (Array.isArray(res)) return res;
    const payload = unwrapData<unknown>(
      res,
      'Invalid leadership anniversaries by month payload'
    );
    if (Array.isArray(payload)) return payload as LeadershipMember[];
    if (isRecord(payload) && Array.isArray(payload.data)) {
      return payload.data as LeadershipMember[];
    }
    return [];
  },
};

export default apiClient;
