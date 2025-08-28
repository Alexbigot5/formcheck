export type JwtUser = {
  id: string;
  email: string;
  roles?: string[];
};

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: { message: string; code?: string };
};


