// src/lib/types.ts - COMPLETE FIXED VERSION

// ========== CORE USER TYPES ==========
export interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: 'user' | 'admin' | 'super_admin' | 'editor'; // Fixed: Added specific roles
  created_at?: string;
  updated_at?: string;
}

// ========== AUTHENTICATION TYPES ==========
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  role: 'user' | 'admin' | 'super_admin' | 'editor'; // Fixed: Added all roles
}

export interface LoginResponseData {
  token: string;
  user: User;
}

export interface AuthResponse {
  status: string;
  message: string;
  data: LoginResponseData;
}

export interface GetCurrentUserResponse {
  success: boolean;
  data: User;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  error: string | null;
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
  id: number;
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
  id: number;
  title: string;
  thumbnail: string;
  videoUrl: string;
  eventId?: number;
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

// ========== API RESPONSE TYPES ==========
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ========== ERROR TYPES ==========
export interface ApiError {
  message: string;
  error?: string;
  statusCode?: number;
}

// ========== LOGIN RESPONSE TYPE (UPDATED) ==========
// REMOVED the conflicting Admin-based LoginResponse
// Use LoginResponseData instead, which matches your backend response
export type LoginResponse = LoginResponseData; // Alias for compatibility

// ========== FILE UPLOAD TYPES ==========
export interface UploadResponse {
  url: string;
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

// ========== COMPATIBILITY TYPES (OPTIONAL - ONLY IF NEEDED) ==========
// If you need Admin type for legacy code, create it as a subset of User
export type Admin = Pick<User, 'id' | 'first_name' | 'last_name' | 'email' | 'role'> & {
  // Add any Admin-specific properties here
};