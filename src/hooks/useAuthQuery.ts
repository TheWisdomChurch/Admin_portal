// src/hooks/useAuthQuery.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authService } from '@/lib/auth';
import type { LoginCredentials, LoginResponse } from '@/lib/types/auth';

const AUTH_QUERY_KEY = ['auth'];

export function useAuthQuery() {
  const queryClient = useQueryClient();

  // Query for auth state
  const { data: authState, isLoading, error } = useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: () => authService.getState(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: true,
  });

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: (credentials: LoginCredentials) => authService.login(credentials),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
    },
    onError: (error: Error) => {
      console.error('Login mutation failed:', error);
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: () => authService.logout(),
    onSuccess: () => {
      queryClient.setQueryData(AUTH_QUERY_KEY, {
        isAuthenticated: false,
        admin: null,
        isLoading: false,
        error: null,
      });
    },
  });

  return {
    // State
    authState: authState || {
      isAuthenticated: false,
      admin: null,
      isLoading: true,
      error: null,
    },
    isLoading,
    error,
    
    // Actions
    login: loginMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    isLoggingOut: logoutMutation.isPending,
  };
}