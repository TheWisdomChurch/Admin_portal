// src/lib/types.ts
// ========== CORE USER TYPES ==========
export interface User {
  id: string; // Consistent string ID for all entities if possible
  first_name: string;
  last_name: string;
  email: string;
  role: 'user' | 'admin' | 'super_admin' | 'editor';
  permissions?: string[]; // Added for permission checks
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  last_login?: string;
}

// ========== AUTHENTICATION TYPES ==========
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
  role?: User['role'];
}

export interface LoginResponseData {
  token: string;
  user: User;
  message?: string;
}

export interface ApiResponse<T = any> {
  success?: boolean;
  status?: string;
  message?: string;
  data?: T;
  error?: string;
  statusCode?: number;
}

export type AuthResponse = ApiResponse<LoginResponseData>;
export type GetCurrentUserResponse = ApiResponse<User>;

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  error: string | null;
}

// ========== AUTH CONTEXT TYPE ==========
export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  login: (credentials: LoginCredentials & { rememberMe?: boolean }) => Promise<User>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<User | null>;
  clearData?: () => Promise<MessageResponse>;
  updateProfile?: (userData: Partial<User>) => Promise<User>;
}

// ========== PAGINATION TYPES ==========
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ========== EVENT TYPES ==========
export interface EventData {
  id: string; // Changed to string for consistency
  title: string;
  description: string;
  shortDescription: string;
  date: string;
  time: string;
  location: string;
  image: string;
  bannerImage?: string;
  attendees: number;
  category: 'Outreach' | 'Conference' | 'Workshop' | 'Prayer' | 'Revival' | 'Summit';
  status: 'upcoming' | 'happening' | 'past';
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
  category: EventData['category'];
  status: EventData['status'];
  isFeatured: boolean;
  tags: string[];
  registerLink?: string;
  speaker?: string;
  contactPhone?: string;
}

// ========== REEL TYPES ==========
export interface ReelData {
  id: string; // Changed to string
  title: string;
  thumbnail: string;
  videoUrl: string;
  eventId?: string;
  duration: string;
  createdAt: string;
}

// ========== TESTIMONIAL TYPES ==========
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

export interface UpdateTestimonialData {
  first_name?: string;
  last_name?: string;
  image_url?: string;
  testimony?: string;
  is_anonymous?: boolean;
  is_approved?: boolean;
}

// ========== DASHBOARD STATS TYPES ==========
export interface DashboardStats {
  totalTestimonials: number;
  totalEvents: number;
  totalUsers: number;
  pendingTestimonials: number;
  recentTestimonials: Testimonial[];
  recentEvents: EventData[];
}

// ========== ERROR TYPES ==========
export interface ApiError extends Error {
  message: string;
  statusCode?: number;
  originalError?: any;
  response?: any;
  details?: unknown; // Changed from any
}

// ========== FILE UPLOAD TYPES ==========
export interface UploadResponse {
  url: string;
  filename?: string;
  size?: number;
  mimetype?: string;
}

export interface UploadFileOptions {
  type: 'image' | 'video' | 'document';
}

// ========== HEALTH CHECK TYPES ==========
export interface HealthCheckResponse {
  status: string;
  timestamp: string;
  service: string;
  version: string;
  uptime: string;
}

// ========== CONFIG TYPES ==========
export interface AppConfig {
  app: {
    name: string;
    version: string;
    environment: string;
  };
  api: {
    base_path: string;
    version: string;
  };
  features: {
    testimonials: boolean;
    authentication: boolean;
    admin_panel: boolean;
  };
}

// ========== COMPATIBILITY TYPES ==========
export type Admin = User & {
  // Admin-specific properties if any
};

// ========== DASHBOARD ANALYTICS TYPES ==========
export interface DashboardAnalytics {
  totalEvents: number;
  upcomingEvents: number;
  totalAttendees: number;
  eventsByCategory: Record<string, number>;
  monthlyStats: Array<{ month: string; events: number; attendees: number }>;
}

// ========== API CLIENT OPTIONS ==========
export interface ApiClientOptions {
  baseURL?: string;
  timeout?: number;
  headers?: Record<string, string>;
}

// ========== FORM FIELD TYPES ==========
export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'number' | 'date' | 'textarea' | 'select' | 'checkbox';
  required?: boolean;
  placeholder?: string;
  defaultValue?: any;
  options?: Array<{ label: string; value: string }>;
  validation?: {
    pattern?: RegExp;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    message?: string;
  };
}

// ========== NOTIFICATION TYPES ==========
export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  read: boolean;
  createdAt: string;
}

// ========== SETTINGS TYPES ==========
export interface AppSettings {
  siteName: string;
  siteDescription: string;
  contactEmail: string;
  contactPhone: string;
  socialMedia: {
    facebook?: string;
    twitter?: string;
    instagram?: string;
    youtube?: string;
  };
  maintenanceMode: boolean;
}

// ========== ROLE PERMISSIONS ==========
export interface RolePermissions {
  canViewDashboard: boolean;
  canManageEvents: boolean;
  canManageUsers: boolean;
  canManageTestimonials: boolean;
  canManageSettings: boolean;
  canManageReels?: boolean;
  canUploadFiles?: boolean;
}

export type RolePermissionMap = Record<User['role'], RolePermissions>;

// ========== PASSWORD CHANGE TYPES ==========
export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword?: string;
}

// ========== UPDATE PROFILE TYPES ==========
export interface UpdateProfileData {
  first_name?: string;
  last_name?: string;
  email?: string;
}

// ========== CLEAR DATA RESPONSE ==========
export interface ClearDataResponse {
  message: string;
  success?: boolean;
}

// ========== DELETE ACCOUNT RESPONSE ==========
export interface DeleteAccountResponse {
  message: string;
  success?: boolean;
}

// ========== MESSAGE RESPONSE TYPE ==========
export interface MessageResponse {
  message: string;
  success?: boolean;
  statusCode?: number;
}

// ========== API ERROR RESPONSE ==========
export interface ApiErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  details?: unknown;
}