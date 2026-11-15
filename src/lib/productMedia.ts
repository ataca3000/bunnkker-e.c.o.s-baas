export type ProductMediaType = 'image' | 'video' | 'gif';

export interface ProductMediaItem {
  url: string;
  type: ProductMediaType;
  label?: string;
}

export const MAX_PRODUCT_MEDIA_ITEMS = 4;

const VIDEO_EXT_RE = /\.(mp4|webm|mov|m4v|ogv|ogg)(\?|#|$)/i;
const GIF_EXT_RE = /\.gif(\?|#|$)/i;

export function sanitizeMediaUrl(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^javascript:/i.test(trimmed)) return '';
  return trimmed;
}

export function inferProductMediaType(
  urlOrMime: string,
  explicitType?: unknown
): ProductMediaType {
  if (explicitType === 'video' || explicitType === 'gif' || explicitType === 'image') {
    return explicitType;
  }
  const lower = (urlOrMime || '').trim().toLowerCase();
  if (lower.startsWith('data:video/') || lower.startsWith('video/') || VIDEO_EXT_RE.test(lower)) {
    return 'video';
  }
  if (lower.startsWith('data:image/gif') || lower === 'image/gif' || GIF_EXT_RE.test(lower)) {
    return 'gif';
  }
  return 'image';
}

export function normalizeProductMediaList(
  rawList: unknown,
  maxItems: number = MAX_PRODUCT_MEDIA_ITEMS
): ProductMediaItem[] {
  if (!Array.isArray(rawList)) return [];

  const seen = new Set<string>();
  const normalized: ProductMediaItem[] = [];

  for (const entry of rawList) {
    let rawUrl = '';
    let rawType: unknown = undefined;
    let rawLabel: string | undefined = undefined;

    if (typeof entry === 'string') {
      rawUrl = entry;
    } else if (entry && typeof entry === 'object') {
      const obj = entry as Record<string, unknown>;
      rawUrl = typeof obj.url === 'string' ? obj.url : '';
      rawType = obj.type;
      rawLabel = typeof obj.label === 'string' && obj.label.trim() ? obj.label.trim() : undefined;
    }

    const url = sanitizeMediaUrl(rawUrl);
    if (!url || seen.has(url)) continue;
    seen.add(url);

    normalized.push({
      url,
      type: inferProductMediaType(url, rawType),
      ...(rawLabel ? { label: rawLabel } : {}),
    });

    if (normalized.length >= maxItems) break;
  }

  return normalized;
}

export function normalizeProductMedia(product: {
  media?: unknown;
  image?: unknown;
  imageUrl?: unknown;
} | null | undefined): ProductMediaItem[] {
  if (!product) return [];

  const fromMedia = normalizeProductMediaList(product.media, MAX_PRODUCT_MEDIA_ITEMS);
  if (fromMedia.length > 0) {
    return fromMedia;
  }

  const fallbackCandidates = [product.image, product.imageUrl]
    .map(sanitizeMediaUrl)
    .filter(Boolean);

  return normalizeProductMediaList(fallbackCandidates, MAX_PRODUCT_MEDIA_ITEMS);
}

export function getPrimaryProductImage(
  media: ProductMediaItem[],
  fallbackImage?: unknown
): string {
  const firstVisual = media.find((item) => item.type !== 'video');
  if (firstVisual?.url) return firstVisual.url;
  const fallback = sanitizeMediaUrl(fallbackImage);
  if (fallback && inferProductMediaType(fallback) !== 'video') {
    return fallback;
  }
  return media[0]?.url || fallback || '';
}
