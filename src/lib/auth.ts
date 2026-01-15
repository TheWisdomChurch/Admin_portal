// src/lib/auth.ts
import { AuthState, LoginCredentials, LoginResponse } from './types';
import { apiClient } from './api';

export class AuthService {
  private state: AuthState = {
    isAuthenticated: false,
    admin: null,
    isLoading: true,
    error: null,
  };

  private listeners: ((state: AuthState) => void)[] = [];

  constructor() {
    this.initialize();
  }

  private async initialize() {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const admin = await apiClient.getCurrentUser();
        this.updateState({ isAuthenticated: true, admin, isLoading: false });
      } catch (error) {
        localStorage.removeItem('token');
        this.updateState({ isAuthenticated: false, admin: null, isLoading: false, error: 'Session expired' });
      }
    } else {
      this.updateState({ isLoading: false });
    }
  }

  subscribe(listener: (state: AuthState) => void): () => void {
    this.listeners.push(listener);
    // Immediately notify with current state
    listener(this.state);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private updateState(partialState: Partial<AuthState>) {
    this.state = { ...this.state, ...partialState };
    this.listeners.forEach((listener) => listener(this.state));
  }

  getState(): AuthState {
    return { ...this.state };
  }

  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    this.updateState({ isLoading: true, error: null });
    try {
      const response = await apiClient.login(credentials);
      const admin = response.admin || await apiClient.getCurrentUser();
      this.updateState({ isAuthenticated: true, admin, isLoading: false });
      return response;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Login failed';
      this.updateState({ isLoading: false, error: errorMessage });
      throw new Error(errorMessage);
    }
  }

  async logout(): Promise<void> {
    this.updateState({ isLoading: true });
    try {
      await apiClient.logout();
    } finally {
      localStorage.removeItem('token');
      this.updateState({ isAuthenticated: false, admin: null, isLoading: false, error: null });
    }
  }

  clearError(): void {
    this.updateState({ error: null });
  }
}

export const authService = new AuthService();