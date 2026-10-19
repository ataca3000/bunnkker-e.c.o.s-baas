/**
 * Utilities for extracting GPS coordinates from Google Maps URLs.
 *
 * Priority (highest → lowest):
 *   1. !3d<lat>!4d<lng>  — actual place-pin (protobuf data= param)
 *   2. @lat,lng           — map viewport center (dropped-pin fallback)
 *   3. ?q=lat,lng
 *   4. ?query=lat,lng     — Search API (/maps/search/?api=1&query=…)
 *   5. ?ll=lat,lng
 *   6. bare "lat, lng"    — raw coordinate string
 */
export function parseGoogleMapsUrl(url: string): { lat: number; lng: number } | null {
  if (!url) return null;

  // Priority 1 — !3d<lat>!4d<lng> in the data= parameter.
  // This is the ACTUAL place-pin coordinate encoded by Google's protobuf URL scheme.
  // It is more accurate than the @lat,lng viewport center, which can differ by hundreds of
  // metres when the user shared the URL while zoomed out.
  const dataMatch = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (dataMatch) {
    const lat = parseFloat(dataMatch[1]);
    const lng = parseFloat(dataMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }

  // Priority 2 — @lat,lng,zoom — map viewport center.
  // Present in /maps/@lat,lng,zoom and /maps/place/…/@lat,lng,zoom URLs.
  // Used as fallback when no !3d!4d pin data is present (e.g. dropped-pin URLs, plain /maps/@).
  const atMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }

  // Priority 3 — ?q=lat,lng or &q=lat,lng
  const qMatch = url.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (qMatch) return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };

  // Priority 4 — ?query=lat,lng (Google Maps Search API: /maps/search/?api=1&query=lat,lng)
  const queryMatch = url.match(/[?&]query=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (queryMatch) return { lat: parseFloat(queryMatch[1]), lng: parseFloat(queryMatch[2]) };

  // Priority 5 — ?ll=lat,lng
  const llMatch = url.match(/[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (llMatch) return { lat: parseFloat(llMatch[1]), lng: parseFloat(llMatch[2]) };

  // Priority 6 — bare coordinate string: "30.0444, 31.2357"
  const coordMatch = url.trim().match(/^(-?\d{1,3}\.?\d*),\s*(-?\d{1,3}\.?\d*)$/);
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]);
    const lng = parseFloat(coordMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }
  return null;
}

/** Returns true for any URL the import engine knows how to handle (short URLs, long URLs, raw coords). */
export function isGoogleMapsUrl(url: string): boolean {
  if (!url) return false;
  if (/maps\.app\.goo\.gl|google\.com\/maps|maps\.google\.com|goo\.gl\/maps/.test(url)) return true;
  if (/^-?\d{1,3}\.?\d*,\s*-?\d{1,3}\.?\d*$/.test(url.trim())) return true;
  return false;
}
