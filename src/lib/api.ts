/* =========================
   CORE USER TYPES
========================= */

export type UserRole = 'admin' | 'super_admin';

export interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: UserRole;
  permissions?: string[];
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  last_login_at?: string;
}

/* =========================
   AUTH TYPES
========================= */

export type RegisterRole = UserRole;

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterData {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  role: RegisterRole;
  rememberMe?: boolean;
}

export interface LoginChallenge {
  otp_required: true;
  purpose: string;
  expires_at?: string;
  action_url?: string;
  email: string;
}

export type LoginResult =
  | { user: User; otp_required?: false }
  | LoginChallenge;

export interface PasswordResetRequestPayload {
  email: string;
}

export interface PasswordResetConfirmPayload {
  email: string;
  code: string;
  purpose: string;
  newPassword: string;
  confirmPassword?: string;
}

/**
 * Generic API response wrapper (backend uses status/message/data).
 * Note: For login/register, "data" may be { user: User } or an OTP challenge.
 */
export interface ApiResponse<T = unknown> {
  status?: string;
  message: string;
  data?: T;
  error?: string;
  statusCode?: number;
}

/* =========================
   PAGINATION
========================= */

export interface PaginationMeta {
  page: number;
  limit: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface PaginatedResponse<T> {
  status?: string;
  message?: string;
  data: T[];
  meta: PaginationMeta;
}

export interface SimplePaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/* =========================
   EVENTS
========================= */

export type EventCategory =
  | 'Outreach'
  | 'Conference'
  | 'Workshop'
  | 'Prayer'
  | 'Revival'
  | 'Summit';

export type EventStatus = 'upcoming' | 'happening' | 'past';

export interface EventData {
  id: string;
  title: string;
  description: string;
  shortDescription: string;
  date: string;
  time: string;
  location: string;
  image?: string;
  bannerImage?: string;
  attendees: number;
  category: EventCategory;
  status: EventStatus;
  isFeatured: boolean;
  tags: string[];
  registerLink?: string;
  speaker?: string;
  contactPhone?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EventPayload {
  title: string;
  description: string;
  shortDescription: string;
  date: string;
  time: string;
  startDate?: string;
  endDate?: string;
  registrationClosesAt?: string;
  sessions?: Array<{ title: string; time: string }>;
  location: string;
  category: EventCategory;
  status: EventStatus;
  isFeatured: boolean;
  tags: string[];
  registerLink?: string;
  speaker?: string;
  contactPhone?: string;
  image?: string;
  bannerImage?: string;
  attendees?: number;
}

/* =========================
   REELS
========================= */

export interface ReelData {
  id: string;
  title: string;
  thumbnail: string;
  videoUrl: string;
  eventId?: string;
  duration: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReelData {
  title: string;
  thumbnail: string;
  videoUrl: string;
  duration: string;
  eventId?: string;
}

/* =========================
   TESTIMONIALS
========================= */

export interface Testimonial {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  imageUrl?: string;
  testimony: string;
  isAnonymous: boolean;
  isApproved: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTestimonialData {
  firstName: string;
  lastName: string;
  imageUrl?: string;
  testimony: string;
  isAnonymous: boolean;
}

export interface UpdateTestimonialData {
  firstName?: string;
  lastName?: string;
  imageUrl?: string;
  testimony?: string;
  isAnonymous?: boolean;
  isApproved?: boolean;
}

/* =========================
   DASHBOARD ANALYTICS
========================= */

export interface DashboardAnalytics {
  totalEvents: number;
  upcomingEvents: number;
  totalAttendees: number;
  eventsByCategory: Record<string, number>;
  monthlyStats: Array<{ month: string; events: number; attendees: number }>;
}

/* =========================
   SUBSCRIBERS + NOTIFICATIONS
========================= */

export type SubscriberStatus = 'active' | 'unsubscribed';

export interface Subscriber {
  id: string;
  email: string;
  name?: string;
  source?: string;
  status: SubscriberStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SubscribeRequest {
  email: string;
  name?: string;
  source?: string;
}

export interface UnsubscribeRequest {
  email: string;
}

export type NotificationType = 'update' | 'event';

export interface Notification {
  id: string;
  type: NotificationType;
  subject: string;
  title: string;
  message: string;
  eventId?: string;
  createdAt: string;
}

export interface SendNotificationRequest {
  type: NotificationType;
  subject: string;
  title: string;
  message: string;
  eventId?: string;
}

export interface SendNotificationResult {
  notification?: Notification;
  total: number;
  sent: number;
  failed: number;
}

/* =========================
   OTP
========================= */

export interface SendOTPRequest {
  email: string;
  purpose?: string;
  actionUrl?: string;
  actionLabel?: string;
}

export interface VerifyOTPRequest {
  email: string;
  code: string;
  purpose?: string;
}

export interface SendOTPResponse {
  expiresAt: string;
  purpose?: string;
  actionUrl?: string;
}

export interface VerifyOTPResponse {
  verified: boolean;
}

/* =========================
   FORMS
========================= */

export type FormFieldType =
  | 'text'
  | 'email'
  | 'tel'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'radio'
  | 'number'
  | 'date';

export interface FormFieldOption {
  label: string;
  value: string;
}

export interface FormField {
  id: string;
  formId?: string;
  key: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  options?: FormFieldOption[];
  order: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface FormDesignSettings {
  heroTitle?: string;
  heroSubtitle?: string;
  coverImageUrl?: string;
  primaryColor?: string; // hex #RRGGBB
  backgroundColor?: string; // hex #RRGGBB
  accentColor?: string; // hex #RRGGBB
  layout?: 'split' | 'stacked' | 'inline';
  ctaButtonLabel?: string;
  privacyCopy?: string;
  footerNote?: string;
}

export interface FormSettings {
  capacity?: number;
  closesAt?: string; // ISO
  successMessage?: string;
  design?: FormDesignSettings;
}

export interface AdminForm {
  id: string;
  title: string;
  description?: string;
  eventId?: string;
  slug?: string;
  isPublished: boolean;
  settings?: FormSettings;
  fields: FormField[];
  createdAt: string;
  updatedAt: string;
}

export interface PublicFormPayload {
  form: AdminForm;
  event?: EventData;
}

export interface CreateFormRequest {
  title: string;
  description?: string;
  slug?: string;
  eventId?: string;
  settings?: FormSettings;
  fields: Array<Omit<FormField, 'id' | 'formId' | 'createdAt' | 'updatedAt'>>;
}

export interface UpdateFormRequest extends Partial<CreateFormRequest> {}

export interface SubmitFormRequest {
  values: Record<string, string | boolean | number>;
}

export interface FormSubmission {
  id: string;
  formId: string;
  name?: string;
  email?: string;
  contactNumber?: string;
  contactAddress?: string;
  values: Record<string, string | boolean | number>;
  createdAt: string;
  updatedAt: string;
}

export interface FormSubmissionCount {
  formId: string;
  formTitle: string;
  count: number;
}

export interface FormSubmissionWithForm {
  id: string;
  formId: string;
  formTitle: string;
  name?: string;
  email?: string;
  contactNumber?: string;
  contactAddress?: string;
  values: Record<string, string | boolean | number>;
  createdAt: string;
}

export interface FormStatsResponse {
  totalSubmissions: number;
  perForm: FormSubmissionCount[];
  recent: FormSubmissionWithForm[];
}

/* =========================
   WORKFORCE
========================= */

export type WorkforceStatus = 'pending' | 'new' | 'serving' | 'not_serving';

export interface WorkforceMember {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  department: string;
  status: WorkforceStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkforceRequest {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  department: string;
  /**
   * Optional for admin-created records; public apply defaults to pending.
   */
  status?: Extract<WorkforceStatus, 'pending' | 'new'>;
  notes?: string;
}

export interface UpdateWorkforceRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  department?: string;
  status?: WorkforceStatus;
  notes?: string;
}

export interface WorkforceBucket {
  department: string;
  status: WorkforceStatus;
  count: number;
}

export interface WorkforceStatsResponse {
  total: number;
  byStatus: Record<string, number>;
  byDepartment: Record<string, number>;
  byDeptAndStatus: WorkforceBucket[];
}

/* =========================
   MISC
========================= */

export interface MessageResponse {
  status?: string;
  message: string;
  data?: unknown;
  success?: boolean;
  statusCode?: number;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword?: string;
}

export interface HealthCheckResponse {
  status: string;
  timestamp: string;
  service: string;
  version: string;
  uptime: string;
}

/* ============================================================================

   API CLIENT
============================================================================ */

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

/* ============================================================================
   Response Normalizers
============================================================================ */

function extractUser(response: any): User {
  const data = response?.data ?? response;
  if (data?.user?.id && data.user?.email) return data.user as User;
  if (data?.id && data?.email) return data as User;
  throw createApiError('Invalid user payload', 400, response);
}

function unwrapData<T>(res: any, errorMessage: string): T {
  if (res && typeof res === 'object' && 'data' in res) {
    const data = (res as ApiResponse<any>).data;
    if (data === undefined || data === null)
      throw createApiError(errorMessage, 400, res);
    return data as T;
  }
  return res as T;
}

function extractLoginResult(res: any): LoginResult {
  const data = res?.data ?? res;
  if (data?.user) return { user: data.user as User };
  if (data?.otp_required) {
    return {
      otp_required: true,
      purpose: data.purpose,
      expires_at: data.expires_at,
      action_url: data.action_url,
      email: data.email,
    } as LoginChallenge;
  }
  throw createApiError('Invalid login payload', 400, res);
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

  async login(credentials: LoginCredentials): Promise<LoginResult> {
    const res = await apiFetch<ApiResponse<any>>('/auth/login', {
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
    const res = await apiFetch<ApiResponse<any>>('/auth/login/verify-otp', {
      method: 'POST',
      body: JSON.stringify(payload),
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
  },

  async getCurrentUser(): Promise<User> {
    const res = await apiFetch<ApiResponse<any>>('/auth/me', {
      method: 'GET',
    });
    return extractUser(res);
  },

  async updateProfile(userData: Partial<User>): Promise<User> {
    const res = await apiFetch<ApiResponse<any>>('/auth/update-profile', {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
    return extractUser(res);
  },

  async changePassword(
    currentPassword: string,
    newPassword: string,
    confirmPassword?: string
  ): Promise<MessageResponse> {
    return apiFetch('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
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

  async getAllTestimonials(params?: {
    approved?: boolean;
  }): Promise<Testimonial[]> {
    const qs =
      params?.approved !== undefined ? `?approved=${params.approved}` : '';
    const res = await apiFetch<ApiResponse<Testimonial[]>>(
      `/testimonials${qs}`
    );
    return unwrapData<Testimonial[]>(res, 'Invalid testimonials payload');
  },

  getPaginatedTestimonials(
    params?: Record<string, string>
  ): Promise<PaginatedResponse<Testimonial>> {
    const qs = params ? `?${new URLSearchParams(params)}` : '';
    return apiFetch(`/testimonials/paginated${qs}`);
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

  /* ===================== ADMIN ===================== */

  async getDashboardStats(): Promise<Record<string, any>> {
    const res = await apiFetch<ApiResponse<any>>('/admin/dashboard');
    return unwrapData<Record<string, any>>(res, 'Invalid dashboard stats');
  },

  getAllUsers(params?: Record<string, string>) {
    const qs = params ? `?${new URLSearchParams(params)}` : '';
    return apiFetch(`/admin/users${qs}`);
  },

  /* ===================== ANALYTICS ===================== */

  async getAnalytics(params?: Record<string, any>): Promise<DashboardAnalytics> {
    const qs = toQueryString(params);
    const res = await apiFetch<ApiResponse<any>>(
      `/admin/analytics${qs}`,
      { method: 'GET' }
    );
    return unwrapData<DashboardAnalytics>(res, 'Invalid analytics payload');
  },

  /* ===================== EVENTS ===================== */

  async getEvents(
    params?: Record<string, any>
  ): Promise<SimplePaginatedResponse<EventData>> {
    const qs = toQueryString(params);
    return apiFetch(`/events${qs}`, { method: 'GET' });
  },

  async getEvent(id: string): Promise<EventData> {
    const res = await apiFetch<{ data: EventData }>(
      `/events/${encodeURIComponent(id)}`,
      { method: 'GET' }
    );
    return unwrapData<EventData>(res, 'Invalid event payload');
  },

  async createEvent(data: EventPayload): Promise<EventData> {
    const res = await apiFetch<{ data: EventData }>('/events', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return unwrapData<EventData>(res, 'Invalid event payload');
  },

  async updateEvent(id: string, data: EventPayload): Promise<EventData> {
    const res = await apiFetch<{ data: EventData }>(
      `/events/${encodeURIComponent(id)}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    );
    return unwrapData<EventData>(res, 'Invalid event payload');
  },

  async deleteEvent(id: string): Promise<MessageResponse> {
    return apiFetch(`/events/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  /* ===================== REELS ===================== */

  async getReels(
    params?: Record<string, any>
  ): Promise<SimplePaginatedResponse<ReelData>> {
    const qs = toQueryString(params);
    return apiFetch(`/reels${qs}`, { method: 'GET' });
  },

  async createReel(payload: CreateReelData): Promise<ReelData> {
    const res = await apiFetch<{ data: ReelData }>('/reels', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return unwrapData<ReelData>(res, 'Invalid reel payload');
  },

  async deleteReel(id: string): Promise<MessageResponse> {
    return apiFetch(`/reels/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  /* ===================== FORMS (ADMIN) ===================== */

  async getAdminForms(
    params?: Record<string, any>
  ): Promise<SimplePaginatedResponse<AdminForm>> {
    const qs = toQueryString(params);
    return apiFetch(`/admin/forms${qs}`, { method: 'GET' });
  },

  async getAdminForm(id: string): Promise<AdminForm> {
    const res = await apiFetch<{ data: AdminForm }>(
      `/admin/forms/${encodeURIComponent(id)}`,
      { method: 'GET' }
    );
    return unwrapData<AdminForm>(res, 'Invalid form payload');
  },

  async createAdminForm(payload: CreateFormRequest): Promise<AdminForm> {
    const res = await apiFetch<{ data: AdminForm }>('/admin/forms', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return unwrapData<AdminForm>(res, 'Invalid form payload');
  },

  async updateAdminForm(
    id: string,
    payload: UpdateFormRequest
  ): Promise<AdminForm> {
    const res = await apiFetch<{ data: AdminForm }>(
      `/admin/forms/${encodeURIComponent(id)}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      }
    );
    return unwrapData<AdminForm>(res, 'Invalid form payload');
  },

  async deleteAdminForm(id: string): Promise<MessageResponse> {
    return apiFetch(`/admin/forms/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  async publishAdminForm(id: string): Promise<{ slug: string }> {
    const res = await apiFetch<{ data: { slug: string } }>(
      `/admin/forms/${encodeURIComponent(id)}/publish`,
      { method: 'POST' }
    );
    return unwrapData<{ slug: string }>(res, 'Invalid publish payload');
  },

  async getFormSubmissions(
    id: string,
    params?: Record<string, any>
  ): Promise<SimplePaginatedResponse<FormSubmission>> {
    const qs = toQueryString(params);
    return apiFetch(`/admin/forms/${encodeURIComponent(id)}/submissions${qs}`, {
      method: 'GET',
    });
  },

  async getFormStats(params?: Record<string, any>): Promise<FormStatsResponse> {
    const qs = toQueryString(params);
    const res = await apiFetch<ApiResponse<FormStatsResponse>>(
      `/admin/forms/stats${qs}`,
      { method: 'GET' }
    );
    return unwrapData<FormStatsResponse>(res, 'Invalid form stats payload');
  },

  /* ===================== FORMS (PUBLIC) ===================== */

  async getPublicForm(slug: string): Promise<PublicFormPayload> {
    const res = await apiFetch<{ data: PublicFormPayload }>(
      `/forms/${encodeURIComponent(slug)}`,
      { method: 'GET' }
    );
    return unwrapData<PublicFormPayload>(res, 'Invalid public form payload');
  },

  async submitPublicForm(
    slug: string,
    payload: SubmitFormRequest
  ): Promise<MessageResponse> {
    return apiFetch(`/forms/${encodeURIComponent(slug)}/submissions`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /* ===================== SUBSCRIBERS + NOTIFICATIONS ===================== */

  async subscribe(payload: SubscribeRequest): Promise<Subscriber> {
    const res = await apiFetch<ApiResponse<Subscriber>>('/subscribers', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return unwrapData<Subscriber>(res, 'Invalid subscriber payload');
  },

  async unsubscribe(payload: UnsubscribeRequest): Promise<MessageResponse> {
    return apiFetch('/subscribers/unsubscribe', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async listSubscribers(
    params?: Record<string, any>
  ): Promise<SimplePaginatedResponse<Subscriber>> {
    const qs = toQueryString(params);
    return apiFetch(`/admin/subscribers${qs}`, { method: 'GET' });
  },

  async sendNotification(
    payload: SendNotificationRequest
  ): Promise<SendNotificationResult> {
    const res = await apiFetch<ApiResponse<SendNotificationResult>>(
      '/admin/notifications',
      { method: 'POST', body: JSON.stringify(payload) }
    );
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

  async listWorkforce(
    params?: Record<string, any>
  ): Promise<SimplePaginatedResponse<WorkforceMember>> {
    const qs = toQueryString(params);
    return apiFetch(`/admin/workforce${qs}`, { method: 'GET' });
  },

  async createWorkforce(
    payload: CreateWorkforceRequest
  ): Promise<WorkforceMember> {
    const res = await apiFetch<ApiResponse<WorkforceMember>>('/admin/workforce', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return unwrapData<WorkforceMember>(res, 'Invalid workforce payload');
  },

  async updateWorkforce(
    id: string,
    payload: UpdateWorkforceRequest
  ): Promise<WorkforceMember> {
    const res = await apiFetch<ApiResponse<WorkforceMember>>(
      `/admin/workforce/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }
    );
    return unwrapData<WorkforceMember>(res, 'Invalid workforce payload');
  },

  async approveWorkforce(id: string): Promise<WorkforceMember> {
    const res = await apiFetch<ApiResponse<WorkforceMember>>(
      `/admin/workforce/${encodeURIComponent(id)}/approve`,
      { method: 'PATCH' }
    );
    return unwrapData<WorkforceMember>(res, 'Invalid workforce payload');
  },

  async applyToWorkforce(
    payload: CreateWorkforceRequest
  ): Promise<WorkforceMember> {
    const res = await apiFetch<ApiResponse<WorkforceMember>>('/workforce/apply', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return unwrapData<WorkforceMember>(res, 'Invalid workforce payload');
  },

  async getWorkforceStats(): Promise<WorkforceStatsResponse> {
    const res = await apiFetch<ApiResponse<WorkforceStatsResponse>>(
      '/admin/workforce/stats',
      { method: 'GET' }
    );
    return unwrapData<WorkforceStatsResponse>(res, 'Invalid workforce stats payload');
  },
};

export default apiClient;
