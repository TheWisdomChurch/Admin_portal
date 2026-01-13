// src/lib/auth.ts - Fixed version
import { apiClient } from './api';
import type { 
  Admin, 
  LoginCredentials, 
  LoginResponse, 
  AuthState 
} from './types';

class AuthService {
  private static instance: AuthService | null = null;
  private listeners: Set<(state: AuthState) => void> = new Set();
  private refreshTimeout: NodeJS.Timeout | null = null;
  
  private state: AuthState = {
    isAuthenticated: false,
    admin: null,
    isLoading: true,
    error: null,
  };

  private constructor() {
    // Private constructor to prevent direct instantiation
  }

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
      AuthService.instance.initialize();
    }
    return AuthService.instance;
  }

  private async initialize(): Promise<void> {
    try {
      const token = this.getStoredToken();
      
      if (token) {
        apiClient.setToken(token);
        const admin = await apiClient.getCurrentAdmin();
        
        this.setState({
          isAuthenticated: true,
          admin,
          isLoading: false,
          error: null,
        });

        this.scheduleTokenRefresh();
      } else {
        this.setState({
          ...this.state,
          isLoading: false,
        });
      }
    } catch (error) {
      console.error('Auth initialization failed:', error);
      this.clearAuth();
      this.setState({
        ...this.state,
        isLoading: false,
        error: 'Session expired. Please login again.',
      });
    }
  }

  private getStoredToken(): string | null {
    if (typeof window === 'undefined') return null;
    
    try {
      return localStorage.getItem('adminToken');
    } catch (error) {
      console.error('Failed to access localStorage:', error);
      return null;
    }
  }

  private setStoredToken(token: string): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem('adminToken', token);
    } catch (error) {
      console.error('Failed to set token in localStorage:', error);
    }
  }

  private removeStoredToken(): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.removeItem('adminToken');
    } catch (error) {
      console.error('Failed to remove token from localStorage:', error);
    }
  }

  private setState(newState: Partial<AuthState>): void {
    const oldState = this.state;
    this.state = { ...this.state, ...newState };
    
    // Only notify if state actually changed
    if (JSON.stringify(oldState) !== JSON.stringify(this.state)) {
      this.notifyListeners();
    }
  }

  private notifyListeners(): void {
    // Copy listeners to prevent modification during iteration
    const listeners = Array.from(this.listeners);
    listeners.forEach(listener => {
      try {
        listener(this.state);
      } catch (error) {
        console.error('Error in auth listener:', error);
      }
    });
  }

  private scheduleTokenRefresh(): void {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }

    // Refresh token 5 minutes before expiry (assuming 1-hour token)
    const refreshTime = 55 * 60 * 1000; // 55 minutes
    
    this.refreshTimeout = setTimeout(() => {
      this.refreshToken().catch(error => {
        console.error('Token refresh failed:', error);
      });
    }, refreshTime);
  }

  private clearRefreshTimeout(): void {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = null;
    }
  }

  // Public API
  public getState(): AuthState {
    return { ...this.state };
  }

  public subscribe(listener: (state: AuthState) => void): () => void {
    this.listeners.add(listener);
    
    // Immediately notify with current state
    setTimeout(() => listener(this.state), 0);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  public async login(credentials: LoginCredentials): Promise<LoginResponse> {
    try {
      this.setState({ isLoading: true, error: null });
      
      const response = await apiClient.login(credentials);
      
      this.setStoredToken(response.token);
      apiClient.setToken(response.token);
      
      this.setState({
        isAuthenticated: true,
        admin: response.admin,
        isLoading: false,
        error: null,
      });

      this.scheduleTokenRefresh();
      
      return response;
    } catch (error: any) {
      const errorMessage = error?.message || 'Login failed. Please check your credentials.';
      
      this.setState({
        isLoading: false,
        error: errorMessage,
      });
      
      throw new Error(errorMessage);
    }
  }

  public async logout(): Promise<void> {
    try {
      if (this.state.isAuthenticated) {
        await apiClient.logout();
      }
    } catch (error) {
      console.error('Logout API call failed:', error);
      // Continue with local logout even if API call fails
    } finally {
      this.clearAuth();
    }
  }

  public async refreshToken(): Promise<void> {
    if (!this.state.isAuthenticated) return;

    try {
      // For now, just revalidate the current token
      const admin = await apiClient.getCurrentAdmin();
      this.setState({ admin });
      this.scheduleTokenRefresh();
    } catch (error) {
      console.error('Token refresh failed:', error);
      this.clearAuth();
      this.setState({
        error: 'Session expired. Please login again.',
      });
    }
  }

  public clearError(): void {
    this.setState({ error: null });
  }

  private clearAuth(): void {
    this.clearRefreshTimeout();
    this.removeStoredToken();
    apiClient.clearToken();
    
    this.setState({
      isAuthenticated: false,
      admin: null,
      isLoading: false,
      error: null,
    });
  }

  // Cleanup method for app shutdown
  public destroy(): void {
    this.clearRefreshTimeout();
    this.listeners.clear();
    AuthService.instance = null;
  }
}

// Export singleton instance
export const authService = AuthService.getInstance();