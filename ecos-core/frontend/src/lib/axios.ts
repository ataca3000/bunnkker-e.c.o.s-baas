import axios from 'axios';

import { env } from '@/lib/env';
import { tokenStorage } from '@/lib/token-storage';

/**
 * Pre-configured Axios instance for the ECOS API.
 *
 * - Request interceptor attaches the Bearer token (if any).
 * - Response interceptor clears the token and triggers logout on HTTP 401.
 */
export const api = axios.create({
  baseURL: env.apiUrl,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

// Allow the auth store to register a handler without creating a circular import.
let onUnauthorized: (() => void) | null = null;

export function setOnUnauthorized(handler: () => void): void {
  onUnauthorized = handler;
}

api.interceptors.request.use((config) => {
  const token = tokenStorage.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      tokenStorage.clear();
      onUnauthorized?.();
    }
    return Promise.reject(error);
  },
);
