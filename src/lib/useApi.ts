import { useQuery, useMutation, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { AxiosError, AxiosResponse } from 'axios';
import apiClient from './apiClient';
import { queryClient, invalidateQueries } from './queryClient';
import { ApiResponse, PaginatedResponse, ApiError, QueryOptions, MutationCallbacks, UploadResponse } from './types';

// Generic GET hook
export function useGet<TData = any>(
  queryKey: readonly unknown[],
  url: string,
  options?: QueryOptions & Omit<UseQueryOptions<TData, AxiosError<ApiError>>, 'queryKey' | 'queryFn'>
) {
  return useQuery<TData, AxiosError<ApiError>>({
    queryKey,
    queryFn: async () => {
      const response: AxiosResponse<TData> = await apiClient.get(url);
      return response.data; // Data is already unwrapped by the interceptor
    },
    ...options,
  });
}

// Generic GET hook for paginated data
export function useGetPaginated<TData = any>(
  queryKey: readonly unknown[],
  url: string,
  options?: QueryOptions & Omit<UseQueryOptions<{items: TData[], pagination: any}, AxiosError<ApiError>>, 'queryKey' | 'queryFn'>
) {
  return useQuery<{items: TData[], pagination: any}, AxiosError<ApiError>>({
    queryKey,
    queryFn: async () => {
      const response: AxiosResponse<{items: TData[], pagination: any}> = await apiClient.get(url);
      return response.data; // Data is already unwrapped by the interceptor
    },
    ...options,
  });
}

// Generic POST hook
export function usePost<TData = any, TVariables = any>(
  url: string,
  options?: MutationCallbacks<TData, AxiosError<ApiError>, TVariables> & 
    Omit<UseMutationOptions<TData, AxiosError<ApiError>, TVariables>, 'mutationFn'>
) {
  return useMutation<TData, AxiosError<ApiError>, TVariables>({
    mutationFn: async (data: TVariables) => {
      const response: AxiosResponse<TData> = await apiClient.post(url, data);
      return response.data; // Data is already unwrapped by the interceptor
    },
    ...options,
  });
}

// Generic PUT hook
export function usePut<TData = any, TVariables = any>(
  url: string,
  options?: MutationCallbacks<TData, AxiosError<ApiError>, TVariables> & 
    Omit<UseMutationOptions<TData, AxiosError<ApiError>, TVariables>, 'mutationFn'>
) {
  return useMutation<TData, AxiosError<ApiError>, TVariables>({
    mutationFn: async (data: TVariables) => {
      const response: AxiosResponse<TData> = await apiClient.put(url, data);
      return response.data; // Data is already unwrapped by the interceptor
    },
    ...options,
  });
}

// Generic PATCH hook
export function usePatch<TData = any, TVariables = any>(
  url: string,
  options?: MutationCallbacks<TData, AxiosError<ApiError>, TVariables> & 
    Omit<UseMutationOptions<TData, AxiosError<ApiError>, TVariables>, 'mutationFn'>
) {
  return useMutation<TData, AxiosError<ApiError>, TVariables>({
    mutationFn: async (data: TVariables) => {
      const response: AxiosResponse<TData> = await apiClient.patch(url, data);
      return response.data; // Data is already unwrapped by the interceptor
    },
    ...options,
  });
}

// Generic DELETE hook
export function useDelete<TData = any>(
  url: string,
  options?: MutationCallbacks<TData, AxiosError<ApiError>, void> & 
    Omit<UseMutationOptions<TData, AxiosError<ApiError>, void>, 'mutationFn'>
) {
  return useMutation<TData, AxiosError<ApiError>, void>({
    mutationFn: async () => {
      const response: AxiosResponse<TData> = await apiClient.delete(url);
      return response.data; // Data is already unwrapped by the interceptor
    },
    ...options,
  });
}

// Generic file upload hook
export function useUpload(
  url: string,
  options?: MutationCallbacks<{file_url: string; file_name: string; file_size: number; mime_type: string}, AxiosError<ApiError>, FormData> & 
    Omit<UseMutationOptions<{file_url: string; file_name: string; file_size: number; mime_type: string}, AxiosError<ApiError>, FormData>, 'mutationFn'>
) {
  return useMutation<{file_url: string; file_name: string; file_size: number; mime_type: string}, AxiosError<ApiError>, FormData>({
    mutationFn: async (formData: FormData) => {
      const response: AxiosResponse<{file_url: string; file_name: string; file_size: number; mime_type: string}> = await apiClient.post(url, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data; // Data is already unwrapped by the interceptor
    },
    ...options,
  });
}

// Utility hooks for common operations
export function useInvalidateQueries() {
  return {
    invalidateAll: () => queryClient.invalidateQueries(),
    invalidateLeads: () => invalidateQueries.leads(),
    invalidateForms: () => invalidateQueries.forms(),
    invalidateScoring: () => invalidateQueries.scoring(),
    invalidateRouting: () => invalidateQueries.routing(),
    invalidateIntegrations: () => invalidateQueries.integrations(),
    invalidateAnalytics: () => invalidateQueries.analytics(),
    invalidateSettings: () => invalidateQueries.settings(),
    invalidateEmailTemplates: () => invalidateQueries.emailTemplates(),
  };
}

// Hook to get query status across multiple queries
export function useQueryStates(queryKeys: readonly unknown[][]) {
  const queries = queryKeys.map(key => queryClient.getQueryState(key));
  
  return {
    isLoading: queries.some(query => query?.status === 'pending'),
    isError: queries.some(query => query?.status === 'error'),
    isSuccess: queries.every(query => query?.status === 'success'),
    errors: queries.filter(query => query?.error).map(query => query?.error),
  };
}

// Hook for optimistic updates
export function useOptimisticUpdate<TData = any>(queryKey: readonly unknown[]) {
  return {
    setOptimisticData: (updater: (old: TData | undefined) => TData) => {
      queryClient.setQueryData(queryKey, updater);
    },
    rollback: (previousData: TData) => {
      queryClient.setQueryData(queryKey, previousData);
    },
  };
}

// Hook for manual data fetching without caching
export function useLazyGet<TData = any>() {
  return useMutation<TData, AxiosError<ApiError>, string>({
    mutationFn: async (url: string) => {
      const response: AxiosResponse<TData> = await apiClient.get(url);
      return response.data; // Data is already unwrapped by the interceptor
    },
  });
}

// Error handling utilities
export function getErrorMessage(error: AxiosError<ApiError>): string {
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  if (error.response?.data?.errors) {
    const errors = Object.values(error.response.data.errors).flat();
    return errors.join(', ');
  }
  if (error.message) {
    return error.message;
  }
  return 'An unexpected error occurred';
}

export function getErrorStatus(error: AxiosError<ApiError>): number | undefined {
  return error.response?.status;
}

export function isNetworkError(error: AxiosError<ApiError>): boolean {
  return !error.response;
}

// Retry utilities
export function shouldRetry(error: AxiosError<ApiError>): boolean {
  // Don't retry on client errors (4xx) except for 408, 429
  if (error.response?.status) {
    const status = error.response.status;
    if (status >= 400 && status < 500) {
      return status === 408 || status === 429;
    }
  }
  
  // Retry on network errors and server errors (5xx)
  return true;
}

export function getRetryDelay(attemptIndex: number): number {
  // Exponential backoff with jitter
  const baseDelay = 1000; // 1 second
  const maxDelay = 30000; // 30 seconds
  const delay = Math.min(baseDelay * Math.pow(2, attemptIndex), maxDelay);
  const jitter = delay * 0.1 * Math.random();
  return delay + jitter;
}
