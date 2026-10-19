export type { Theme } from '@/providers/theme-context';

/**
 * Standard API envelope returned by the ECOS backend
 * (`App\Core\Responses\ApiResponse`).
 */
export type ApiResponse<TData = unknown> = {
  success: boolean;
  message: string | null;
  data: TData;
  errors: Record<string, string[]> | unknown[];
};

export type Nullable<T> = T | null;

export type Id = string | number;
