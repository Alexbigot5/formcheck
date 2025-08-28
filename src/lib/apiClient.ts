import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

// Environment configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
const API_KEY = import.meta.env.VITE_API_KEY;

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add authentication headers
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Add JWT token from localStorage
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add API key if present
    if (API_KEY) {
      config.headers['X-API-Key'] = API_KEY;
    }

    // Add team ID if present
    const teamId = localStorage.getItem('team_id');
    if (teamId) {
      config.headers['X-Team-ID'] = teamId;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle standardized API responses and errors
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    // Handle standardized API response format {ok, data/error}
    if (response.data && typeof response.data === 'object') {
      if (response.data.ok === false) {
        // API returned an error in the standardized format
        const errorMessage = response.data.error || 'An error occurred';
        const error = new Error(errorMessage);
        (error as any).response = response;
        (error as any).apiError = true;
        return Promise.reject(error);
      }
      
      if (response.data.ok === true && response.data.data !== undefined) {
        // Unwrap the data from standardized format
        response.data = response.data.data;
      }
    }
    
    return response;
  },
  (error) => {
    // Handle HTTP errors first
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('team_id');
      localStorage.removeItem('user_role');
      window.location.href = '/login';
      return Promise.reject(error);
    }

    if (error.response?.status === 403) {
      console.error('Access forbidden:', error.response.data?.error || error.response.data?.message || 'Insufficient permissions');
    }

    if (error.response?.status === 429) {
      console.warn('Rate limit exceeded. Please try again later.');
    }

    // Handle standardized error response format
    if (error.response?.data && typeof error.response.data === 'object') {
      if (error.response.data.ok === false && error.response.data.error) {
        error.message = error.response.data.error;
      }
    }

    // Handle network errors
    if (!error.response) {
      console.error('Network error:', error.message);
    }

    return Promise.reject(error);
  }
);

// Helper functions for common operations
export const setAuthToken = (token: string) => {
  localStorage.setItem('auth_token', token);
};

export const removeAuthToken = () => {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('team_id');
  localStorage.removeItem('user_role');
};

export const getAuthToken = (): string | null => {
  return localStorage.getItem('auth_token');
};

export const isAuthenticated = (): boolean => {
  const token = getAuthToken();
  return !!token;
};

export default apiClient;
