// src/lib/types/auth.ts
export interface Admin {
  id: number;
  username: string;
  email: string;
  role: 'super_admin' | 'admin' | 'editor';
  createdAt: string;
  lastLogin?: string;
  permissions?: string[];
}

export interface AuthState {
  isAuthenticated: boolean;
  admin: Admin | null;
  isLoading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

// Make expiresIn optional since your API might not return it
export interface LoginResponse {
  token: string;
  admin: Admin;
  expiresIn?: number; // Changed from required to optional
}

export interface AuthService {
  getState(): AuthState;
  subscribe(listener: (state: AuthState) => void): () => void;
  login(credentials: LoginCredentials): Promise<LoginResponse>;
  logout(): Promise<void>;
  refreshToken(): Promise<void>;
  clearError(): void;
}