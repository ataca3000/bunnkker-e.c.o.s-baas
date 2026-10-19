import { api } from '@/lib/axios';
import type { ApiResponse } from '@/types';
import type { AuthUser, LoginCredentials, LoginResponseData } from '@/features/auth/types';

/**
 * Authentication API calls. Each method unwraps the standardized ECOS
 * ApiResponse envelope and returns the inner `data`.
 */
export const authService = {
  async login(credentials: LoginCredentials): Promise<LoginResponseData> {
    const { data } = await api.post<ApiResponse<LoginResponseData>>('/auth/login', credentials);
    return data.data;
  },

  async me(): Promise<AuthUser> {
    const { data } = await api.get<ApiResponse<AuthUser>>('/auth/me');
    return data.data;
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout');
  },
};
