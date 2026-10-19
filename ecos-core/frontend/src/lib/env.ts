/**
 * Typed, centralized access to Vite environment variables.
 *
 * All app environment variables must be prefixed with `VITE_` to be exposed to
 * the client (see `.env` / `.env.example`).
 */
export const env = {
  appName: import.meta.env.VITE_APP_NAME ?? 'ECOS ERP',
  apiUrl: import.meta.env.VITE_API_URL ?? '/api',
  appEnv: import.meta.env.VITE_APP_ENV ?? import.meta.env.MODE,
} as const;

export type Env = typeof env;
