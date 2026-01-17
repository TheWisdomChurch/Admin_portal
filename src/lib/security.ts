// src/lib/security.ts
export class SecurityManager {
  // Use HttpOnly cookies in production
  static async setAuthToken(token: string, rememberMe = false) {
    if (process.env.NODE_ENV === 'production') {
      // Use HttpOnly cookie
      await fetch('/api/auth/set-cookie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, rememberMe }),
      });
    } else {
      // Use localStorage/sessionStorage in development
      const storage = rememberMe ? localStorage : sessionStorage;
      storage.setItem('auth_token', token);
    }
  }

  static getAuthToken(): string | null {
    if (process.env.NODE_ENV === 'production') {
      // Cannot access HttpOnly cookies from JS
      // You'll need to get it from an API endpoint
      return null;
    } else {
      return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    }
  }

  // Add CSRF token management
  static async getCsrfToken(): Promise<string> {
    const response = await fetch('/api/csrf-token');
    const data = await response.json();
    return data.csrfToken;
  }
}