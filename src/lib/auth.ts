// src/lib/auth.ts
import { apiClient } from './api';
import { User, LoginCredentials, LoginResponseData, AuthState } from './types';

export class AuthService {
  private state: AuthState = {
    isAuthenticated: false,
    user: null,
    isLoading: true,
    error: null,
  };

  private listeners: ((state: AuthState) => void)[] = [];

  constructor() {
    this.initialize();
  }

  private async initialize() {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (token && storedUser) {
      try {
        // First try to use stored user
        const user = JSON.parse(storedUser);
        this.updateState({ 
          isAuthenticated: true, 
          user, 
          isLoading: false 
        });
        
        // Then verify with server (optional)
        try {
          const freshUser = await apiClient.getCurrentUser();
          this.updateState({ user: freshUser });
          localStorage.setItem('user', JSON.stringify(freshUser));
        } catch (error) {
          // Server verification failed, but keep using stored user
          console.log('Server verification failed, using stored user');
        }
      } catch (error) {
        // Clear invalid stored data
        this.clearStoredAuth();
        this.updateState({ 
          isAuthenticated: false, 
          user: null, 
          isLoading: false, 
          error: 'Session expired' 
        });
      }
    } else {
      this.updateState({ isLoading: false });
    }
  }

  private clearStoredAuth() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
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

  async login(credentials: LoginCredentials): Promise<LoginResponseData> {
    this.updateState({ isLoading: true, error: null });
    try {
      // Login to get token
      const loginData = await apiClient.login(credentials);
      
      // Update state with user from login response
      this.updateState({ 
        isAuthenticated: true, 
        user: loginData.user, 
        isLoading: false 
      });
      
      return loginData;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Login failed';
      this.updateState({ 
        isLoading: false, 
        error: errorMessage 
      });
      throw new Error(errorMessage);
    }
  }

  async logout(): Promise<void> {
    this.updateState({ isLoading: true });
    try {
      await apiClient.logout();
    } catch (error) {
      console.error('Logout API error:', error);
      // Continue with local logout even if API fails
    } finally {
      this.clearStoredAuth();
      this.updateState({ 
        isAuthenticated: false, 
        user: null, 
        isLoading: false, 
        error: null 
      });
    }
  }

  clearError(): void {
    this.updateState({ error: null });
  }

  // Helper method to manually update user data
  updateUser(user: User): void {
    localStorage.setItem('user', JSON.stringify(user));
    this.updateState({ user });
  }

  // Helper method to check if user has specific role
  hasRole(role: string): boolean {
    return this.state.isAuthenticated && this.state.user?.role === role;
  }

  // Helper method to check if user is admin
  isAdmin(): boolean {
    return this.hasRole('admin');
  }
}

export const authService = new AuthService();