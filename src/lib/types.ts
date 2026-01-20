// src/lib/types.ts

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
  role?: UserRole;
  rememberMe?: boolean;
}

/**
 * Generic API response wrapper (your backend uses status/message/data).
 * Note: For login/register, "data" may not be a User directly (it may be { user: User }).
 */
export interface ApiResponse<T = unknown> {
  success?: boolean;
  status?: string; // e.g. "success"
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

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/* =========================
   EVENTS (as you currently defined)
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
  image: string;
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

export interface RegisterEventData {
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
}

/* =========================
   TESTIMONIALS
========================= */

export interface Testimonial {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  image_url?: string;
  testimony: string;
  is_anonymous: boolean;
  is_approved: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateTestimonialData {
  first_name: string;
  last_name: string;
  image_url?: string;
  testimony: string;
  is_anonymous: boolean;
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
   MISC
========================= */

export interface MessageResponse {
  message: string;
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

// src/lib/types.ts

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
  key: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  options?: FormFieldOption[];
  order: number;
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
  event?: EventData; // optional - if you want backend to embed event
}

export interface CreateFormRequest {
  title: string;
  description?: string;
  eventId?: string;
  settings?: FormSettings;
  fields: Array<Omit<FormField, 'id'>>;
}

export interface UpdateFormRequest extends Partial<CreateFormRequest> {}

export interface SubmitFormRequest {
  values: Record<string, string | boolean>;
}

