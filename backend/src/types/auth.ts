import { FastifyRequest } from 'fastify';

// Unified user interface for authenticated requests
export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  role: string;
  teamId: string;
}

// API Key interface
export interface AuthApiKey {
  id: string;
  teamId: string;
  name: string;
}

// Extended FastifyRequest with authentication context
export interface AuthenticatedRequest extends FastifyRequest {
  user: AuthUser;  // Make required to fix type issues
  apiKey?: AuthApiKey;
  teamId: string;  // Make required for team isolation
}

// JWT payload type
export type JwtUser = {
  id: string;
  email: string;
  sub: string;  // Add sub field for JWT standard
  roles?: string[];
};

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: { message: string; code?: string };
};
