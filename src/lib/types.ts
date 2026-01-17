// ========== CORE USER TYPES ==========
export interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: 'user' | 'admin' | 'super_admin' | 'editor';
  permissions?: string[];
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
  rememberMe?: boolean;
}

export interface ApiResponse<T = any> {
  success?: boolean;
  status?: string;
  message: string;
  data?: T;
  error?: string;
  statusCode?: number;
}

export type AuthResponse = ApiResponse<User>;
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
  register: (data: RegisterData & { rememberMe?: boolean }) => Promise<User>;
  clearData: () => Promise<MessageResponse>;
  updateProfile: (userData: Partial<User>) => Promise<User>;
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
  id: string;
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

// ========== DASHBOARD ANALYTICS TYPES ==========
export interface DashboardAnalytics {
  totalEvents: number;
  upcomingEvents: number;
  totalAttendees: number;
  eventsByCategory: Record<string, number>;
  monthlyStats: Array<{ month: string; events: number; attendees: number }>;
}

// ========== ERROR TYPES ==========
export interface ApiError extends Error {
  message: string;
  statusCode?: number;
  originalError?: any;
  response?: any;
  details?: unknown;
}

// ========== MESSAGE RESPONSE TYPE ==========
export interface MessageResponse {
  message: string;
  success?: boolean;
  statusCode?: number;
}

// ========== PASSWORD CHANGE TYPES ==========
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
