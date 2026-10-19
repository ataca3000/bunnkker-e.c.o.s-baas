import { env } from '@/lib/env';

/**
 * Minimal, generic JSON fetch wrapper used as the foundation for future API
 * services. Contains no business logic.
 *
 * @typeParam T - Expected shape of the JSON response.
 */
export async function http<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${env.apiUrl}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}
