import { describe, it, expect } from 'vitest';
import { parseGoogleMapsUrl, isGoogleMapsUrl } from './google-maps-parser';

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Assert two floats are identical to 5 decimal places (~1 metre). */
function expectCoords(
  result: { lat: number; lng: number } | null,
  lat: number,
  lng: number,
) {
  expect(result).not.toBeNull();
  expect(result!.lat).toBeCloseTo(lat, 5);
  expect(result!.lng).toBeCloseTo(lng, 5);
}

// ─── parseGoogleMapsUrl ───────────────────────────────────────────────────────

describe('parseGoogleMapsUrl', () => {

  // ── Priority-1: !3d!4d actual place-pin ─────────────────────────────────────

  describe('Place URL — viewport ≠ pin (Priority-1 !3d!4d must win)', () => {
    it('returns the !3d!4d pin, not the @viewport center, when they differ', () => {
      // This is THE regression case. Before the fix, @30.04,31.22 was returned instead.
      const url =
        'https://www.google.com/maps/place/Restaurant/@30.04,31.22,17z' +
        '/data=!4m6!3m5!1s0x14584172ef16f8c9:0x2b6!8m2!3d30.0444!4d31.2357';
      expectCoords(parseGoogleMapsUrl(url), 30.0444, 31.2357);
    });

    it('handles 6-decimal-place pin coords (typical KFC-style share URL)', () => {
      const url =
        'https://www.google.com/maps/place/KFC/@30.0444,31.2357,17z' +
        '/data=!4m14!1m7!3m6!1s0x14584172ef16f8c9:0x2b6!2sKFC!8m2!3d30.044424!4d31.235701' +
        '!3m5!1s0x14584172ef16f8c9:0x2b6!8m2!3d30.044424!4d31.235701';
      expectCoords(parseGoogleMapsUrl(url), 30.044424, 31.235701);
    });
  });

  describe('Place URL — viewport = pin (both sources agree)', () => {
    it('returns the correct coordinates when @viewport matches !3d!4d', () => {
      const url =
        'https://www.google.com/maps/place/Cairo+Tower/@30.0575,31.2244,17z' +
        '/data=!8m2!3d30.0575!4d31.2244';
      expectCoords(parseGoogleMapsUrl(url), 30.0575, 31.2244);
    });
  });

  // ── Priority-2: @lat,lng viewport fallback ───────────────────────────────────

  describe('@lat,lng — viewport-center / dropped-pin URLs', () => {
    it('extracts coordinates from a plain /maps/@lat,lng,zoom URL', () => {
      expectCoords(
        parseGoogleMapsUrl('https://www.google.com/maps/@30.0444,31.2357,17z'),
        30.0444, 31.2357,
      );
    });

    it('extracts from a Place URL that has no data= block (no !3d!4d)', () => {
      expectCoords(
        parseGoogleMapsUrl(
          'https://www.google.com/maps/place/Cairo+Tower/@30.0575,31.2244,17z',
        ),
        30.0575, 31.2244,
      );
    });
  });

  // ── Short URLs (resolved to long-form by the backend before parsing) ─────────

  describe('maps.app.goo.gl — resolved URL contains !3d!4d', () => {
    it('parses !3d!4d from a URL that a resolved maps.app.goo.gl link would produce', () => {
      // The backend proxy follows the redirect and returns the long URL;
      // the parser then receives that expanded form.
      const resolvedUrl =
        'https://www.google.com/maps/place/TestPlace/@30.04,31.22,17z' +
        '/data=!8m2!3d30.0444!4d31.2357';
      expectCoords(parseGoogleMapsUrl(resolvedUrl), 30.0444, 31.2357);
    });
  });

  describe('goo.gl/maps — resolved URL contains @lat,lng (no data= block)', () => {
    it('falls back to @lat,lng when the resolved URL has no !3d!4d', () => {
      const resolvedUrl =
        'https://www.google.com/maps/@30.0575,31.2244,15z';
      expectCoords(parseGoogleMapsUrl(resolvedUrl), 30.0575, 31.2244);
    });
  });

  // ── Query-string formats ─────────────────────────────────────────────────────

  describe('?q=lat,lng', () => {
    it('parses ?q= with positive coordinates', () => {
      expectCoords(
        parseGoogleMapsUrl('https://www.google.com/maps?q=30.0444,31.2357'),
        30.0444, 31.2357,
      );
    });

    it('parses &q= mid-querystring', () => {
      expectCoords(
        parseGoogleMapsUrl('https://www.google.com/maps?hl=en&q=30.0444,31.2357'),
        30.0444, 31.2357,
      );
    });

    it('ignores ?q= with a place name (not coordinates)', () => {
      expect(parseGoogleMapsUrl('https://www.google.com/maps?q=Cairo+Tower')).toBeNull();
    });
  });

  describe('?query=lat,lng — Search API', () => {
    it('parses the Search API query= parameter with coordinates', () => {
      expectCoords(
        parseGoogleMapsUrl(
          'https://www.google.com/maps/search/?api=1&query=30.0444,31.2357',
        ),
        30.0444, 31.2357,
      );
    });

    it('ignores ?query= with a place name', () => {
      expect(
        parseGoogleMapsUrl(
          'https://www.google.com/maps/search/?api=1&query=Cairo+Tower',
        ),
      ).toBeNull();
    });
  });

  describe('?ll=lat,lng', () => {
    it('parses the legacy ll= parameter', () => {
      expectCoords(
        parseGoogleMapsUrl('https://maps.google.com/?ll=30.0444,31.2357'),
        30.0444, 31.2357,
      );
    });
  });

  // ── Raw coordinate strings ────────────────────────────────────────────────────

  describe('Raw coordinates', () => {
    it('parses "lat, lng" with a space', () => {
      expectCoords(parseGoogleMapsUrl('30.0444, 31.2357'), 30.0444, 31.2357);
    });

    it('parses "lat,lng" without a space', () => {
      expectCoords(parseGoogleMapsUrl('30.0444,31.2357'), 30.0444, 31.2357);
    });

    it('parses coordinates with many decimal places', () => {
      expectCoords(parseGoogleMapsUrl('30.044424,31.235701'), 30.044424, 31.235701);
    });
  });

  // ── Negative coordinates ──────────────────────────────────────────────────────

  describe('Negative latitude (Southern Hemisphere)', () => {
    it('parses negative latitude in @-format', () => {
      expectCoords(
        parseGoogleMapsUrl('https://www.google.com/maps/@-33.8688,151.2093,17z'),
        -33.8688, 151.2093,
      );
    });

    it('parses negative latitude as a raw coordinate pair', () => {
      expectCoords(parseGoogleMapsUrl('-33.8688, 151.2093'), -33.8688, 151.2093);
    });
  });

  describe('Negative longitude (Western Hemisphere)', () => {
    it('parses negative longitude in @-format', () => {
      expectCoords(
        parseGoogleMapsUrl('https://www.google.com/maps/@40.7128,-74.0060,13z'),
        40.7128, -74.006,
      );
    });

    it('parses negative longitude as a raw coordinate pair', () => {
      expectCoords(parseGoogleMapsUrl('40.7128,-74.0060'), 40.7128, -74.006);
    });
  });

  // ── Invalid / out-of-bounds coordinates ──────────────────────────────────────

  describe('Invalid coordinates', () => {
    it('rejects latitude > 90 in !3d!4d — no valid fallback pattern in URL → null', () => {
      // No @lat,lng in the URL either; parser must return null, not a garbage value.
      expect(
        parseGoogleMapsUrl(
          'https://www.google.com/maps/place/X/data=!8m2!3d91.0!4d31.2357',
        ),
      ).toBeNull();
    });

    it('rejects longitude > 180 in !3d!4d — no valid fallback pattern in URL → null', () => {
      expect(
        parseGoogleMapsUrl(
          'https://www.google.com/maps/place/X/data=!8m2!3d30.0444!4d181.0',
        ),
      ).toBeNull();
    });

    it('rejects @lat,lng when latitude is out of range', () => {
      // 999 is clearly not a valid latitude; the @ branch validates bounds
      expect(
        parseGoogleMapsUrl('https://www.google.com/maps/@999.0,31.2357,17z'),
      ).toBeNull();
    });

    it('rejects raw string where latitude is out of range', () => {
      expect(parseGoogleMapsUrl('91.0, 31.2357')).toBeNull();
    });

    it('rejects raw string where longitude is out of range', () => {
      expect(parseGoogleMapsUrl('30.0444, 181.0')).toBeNull();
    });
  });

  // ── No coordinates at all ─────────────────────────────────────────────────────

  describe('No coordinates', () => {
    it('returns null for a bare place-name URL with no coordinates', () => {
      expect(
        parseGoogleMapsUrl('https://www.google.com/maps/place/Cairo+Tower'),
      ).toBeNull();
    });

    it('returns null for an empty string', () => {
      expect(parseGoogleMapsUrl('')).toBeNull();
    });

    it('returns null for a non-Google URL', () => {
      expect(parseGoogleMapsUrl('https://example.com')).toBeNull();
    });

    it('returns null for a URL with a place-name ?q= only', () => {
      expect(parseGoogleMapsUrl('https://www.google.com/maps?q=Restaurant')).toBeNull();
    });
  });
});

// ─── isGoogleMapsUrl ─────────────────────────────────────────────────────────

describe('isGoogleMapsUrl', () => {
  it('accepts google.com/maps URLs', () => {
    expect(isGoogleMapsUrl('https://www.google.com/maps/@30.0,31.0,17z')).toBe(true);
  });

  it('accepts maps.google.com URLs', () => {
    expect(isGoogleMapsUrl('https://maps.google.com/?ll=30.0,31.0')).toBe(true);
  });

  it('accepts maps.app.goo.gl short URLs', () => {
    expect(isGoogleMapsUrl('https://maps.app.goo.gl/abc123')).toBe(true);
  });

  it('accepts goo.gl/maps short URLs', () => {
    expect(isGoogleMapsUrl('https://goo.gl/maps/abc123')).toBe(true);
  });

  it('accepts raw coordinate pairs', () => {
    expect(isGoogleMapsUrl('30.0444, 31.2357')).toBe(true);
  });

  it('rejects a random non-Maps URL', () => {
    expect(isGoogleMapsUrl('https://example.com/location')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isGoogleMapsUrl('')).toBe(false);
  });
});
