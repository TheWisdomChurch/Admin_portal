/* =========================
   CORE USER TYPES
========================= */

export type UserRole = 'user' | 'admin' | 'super_admin' | 'editor';

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
  last_login?: string;
}

/* =========================
   AUTH TYPES
========================= */

export type RegisterRole = 'user' | 'admin';

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

/**
 * Generic API response wrapper (backend uses status/message/data).
 * Note: For login/register, "data" may be { user: User }.
 */
export interface ApiResponse<T = unknown> {
  status?: string;
  message: string;
  data?: T;
  error?: string;
  statusCode?: number;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  error: string | null;
}

export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  isInitialized: boolean;

  login: (credentials: LoginCredentials) => Promise<User>;
  register: (data: RegisterData) => Promise<User>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<User | null>;

  clearData: () => Promise<MessageResponse>;
  updateProfile: (userData: Partial<User>) => Promise<User>;
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
}

export interface VerifyOTPRequest {
  email: string;
  code: string;
  purpose?: string;
}

export interface SendOTPResponse {
  expiresAt: string;
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

export interface FormSettings {
  capacity?: number;
  closesAt?: string; // ISO
  successMessage?: string;
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
