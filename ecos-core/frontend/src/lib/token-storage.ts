/**
 * Synchronous access to the persisted auth token (localStorage).
 *
 * Kept separate from the store so the Axios interceptor can read it without
 * importing the React store (avoids a circular dependency).
 */
const TOKEN_KEY = 'ecos_token';

export const tokenStorage = {
  get(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },
  set(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  },
  clear(): void {
    localStorage.removeItem(TOKEN_KEY);
  },
};
