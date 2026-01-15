// src/hooks/useApi.ts
import { useState, useCallback } from 'react';
import { apiClient } from '@/lib/api';

export function useApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(async <T>(
    fn: () => Promise<T>,
    options: { onSuccess?: (data: T) => void; onError?: (error: string) => void } = {}
  ) => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await fn();
      if (options.onSuccess) {
        options.onSuccess(data);
      }
      return data;
    } catch (err: any) {
      const errorMessage = err.message || 'An error occurred';
      setError(errorMessage);
      if (options.onError) {
        options.onError(errorMessage);
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getTestimonials = useCallback((params?: any) => 
    request(() => apiClient.getTestimonials(params)), [request]);

  const createTestimonial = useCallback((data: any) =>
    request(() => apiClient.createTestimonial(data)), [request]);

  const updateTestimonial = useCallback((id: string, data: any) =>
    request(() => apiClient.updateTestimonial(id, data)), [request]);

  const deleteTestimonial = useCallback((id: string) =>
    request(() => apiClient.deleteTestimonial(id)), [request]);

  const approveTestimonial = useCallback((id: string) =>
    request(() => apiClient.approveTestimonial(id)), [request]);

  return {
    loading,
    error,
    request,
    getTestimonials,
    createTestimonial,
    updateTestimonial,
    deleteTestimonial,
    approveTestimonial,
    login: apiClient.login.bind(apiClient),
    logout: apiClient.logout.bind(apiClient),
    getCurrentUser: apiClient.getCurrentUser.bind(apiClient),
  };
}