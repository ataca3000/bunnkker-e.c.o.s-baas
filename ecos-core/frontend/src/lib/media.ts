import { env } from '@/lib/env';

/**
 * Resolve any image_url value stored in the database to a browser-loadable URL.
 *
 * Rules:
 *  - null / empty string          → null  (caller renders placeholder)
 *  - https:// or http:// URL      → returned as-is  (CDN, remote image)
 *  - /storage/... path            → prepend backend origin when API URL is absolute
 *  - relative path (no leading /) → treated as a storage-relative path → /storage/{path}
 */
/**
 * Validate that an image URL uses an allowed, safe scheme and does not contain dangerous protocols like javascript:
 */
export function isSafeImageUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (/^(javascript|vbscript):/i.test(trimmed)) return false;
  return (
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.startsWith('/\\'))
  );
}

export function getMediaUrl(path: string | null | undefined): string | null {
  if (!path || path.trim() === '') return null;
  const trimmed = path.trim();
  if (/^(javascript|vbscript):/i.test(trimmed)) return null;

  // Already a full URL — use as-is if http/https
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;

  // Derive the backend origin from VITE_API_URL (e.g. "http://localhost:8000/api")
  // If the API URL is relative ("/api") we're on the same origin as the backend
  // (Vite proxy + nginx in docker), so we use empty string (relative URLs work).
  const backendOrigin = (() => {
    const api = env.apiUrl;
    if (api.startsWith('http://') || api.startsWith('https://')) {
      try { return new URL(api).origin; } catch { return ''; }
    }
    return '';
  })();

  // /storage/xxx path from Laravel's Storage::url()
  if (path.startsWith('/storage/')) {
    return `${backendOrigin}${path}`;
  }

  // Raw relative path stored in DB (e.g. "raw-materials/01J….webp")
  return `${backendOrigin}/storage/${path}`;
}
