import type { Order, OrderLocation } from '@/features/orders/types/order';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AddressData = {
  line1: string | null;
  line2: string | null;
  detail: string | null;
  full: string;
  hasGps: boolean;
};

// ── Helpers — exported for OrderLocationCell ──────────────────────────────────

export function extractAddress(order: Order): AddressData {
  const hasGps = Boolean(order.location?.lat && order.location?.lng);

  const city        = order.city ?? null;
  const area        = order.area ?? order.delivery_zone ?? null;
  const governorate = order.governorate ?? null;
  const street      = order.shipping_address ?? null;
  const building    = order.building ?? null;
  const floor       = order.floor ?? null;
  const apartment   = order.apartment ?? null;
  const landmark    = order.landmark ?? null;

  const hasEnterprise = Boolean(city || area || governorate || street);

  if (hasEnterprise) {
    const line1 = area && city && area !== city ? area : (city ?? area);
    const line2 = governorate ?? null;

    const detailParts = [
      street,
      building  ? `Bld ${building}`   : null,
      floor     ? `Fl ${floor}`       : null,
      apartment ? `Apt ${apartment}`  : null,
      landmark,
    ].filter(Boolean) as string[];

    const fullParts = [line1, line2, ...detailParts].filter(Boolean) as string[];

    return {
      line1,
      line2,
      detail: detailParts.length > 0 ? detailParts.join(' · ') : null,
      full: fullParts.join(', '),
      hasGps,
    };
  }

  const legacyCity   = order.shipping_city ?? order.billing_city ?? null;
  const legacyState  = order.shipping_state ?? order.billing_state ?? null;
  const legacyAddr   = [order.shipping_address_1, order.shipping_address_2].filter(Boolean).join(', ') || null;
  const fallbackAddr = [order.billing_address_1,  order.billing_address_2].filter(Boolean).join(', ') || null;

  const line1 = legacyCity ?? legacyAddr ?? fallbackAddr;
  const line2 = legacyState ?? null;

  if (!line1 && !line2) return { line1: null, line2: null, detail: null, full: '', hasGps };

  const fullParts = [legacyAddr ?? fallbackAddr, legacyCity, legacyState].filter(Boolean) as string[];
  return {
    line1,
    line2: line2 !== line1 ? line2 : null,
    detail: legacyAddr ?? null,
    full: fullParts.join(', '),
    hasGps,
  };
}

export function mapsUrl(location: OrderLocation | null, full: string): string {
  if (location?.lat && location?.lng) {
    return `https://www.google.com/maps?q=${location.lat},${location.lng}`;
  }
  return full ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(full)}` : '#';
}

export function wazeUrl(location: OrderLocation | null): string | null {
  if (!location?.lat || !location?.lng) return null;
  return `https://www.waze.com/ul?ll=${location.lat}%2C${location.lng}&navigate=yes`;
}

// ── Component — text-only, no action buttons ──────────────────────────────────

type Props = { order: Order };

export function OrderAddressCell({ order }: Props) {
  const hasEnterprise = Boolean(
    order.city || order.area || order.delivery_zone || order.governorate || order.shipping_address,
  );

  if (hasEnterprise) {
    // Line 1: zone (city or area)
    const zone = order.area && order.city && order.area !== order.city
      ? order.area
      : (order.city ?? order.area ?? order.delivery_zone ?? null);

    // Line 2: governorate
    const governorate = order.governorate ?? null;

    // Line 3: remaining address fields joined with ", "
    const detailParts = [
      order.shipping_address                        ?? null,
      order.building  ? `Building ${order.building}`  : null,
      order.floor     ? `Floor ${order.floor}`         : null,
      order.apartment ? `Apartment ${order.apartment}` : null,
      order.landmark  ? `Landmark ${order.landmark}`   : null,
    ].filter((v): v is string => Boolean(v));

    const detailLine = detailParts.length > 0 ? detailParts.join(', ') : null;

    if (!zone && !governorate && !detailLine) {
      return <span className="text-muted-foreground">—</span>;
    }

    return (
      <div className="space-y-0.5">
        {zone ? (
          <p className="text-xs font-semibold text-primary leading-tight">📍 {zone}</p>
        ) : null}
        {governorate ? (
          <p className="text-[11px] text-muted-foreground leading-tight">{governorate} Governorate</p>
        ) : null}
        {detailLine ? (
          <p className="text-[11px] text-foreground/60 leading-tight">{detailLine}</p>
        ) : null}
      </div>
    );
  }

  // Legacy path (WooCommerce orders without enterprise address fields)
  const addr = extractAddress(order);
  if (!addr.line1 && !addr.line2) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <div className="space-y-0.5">
      {addr.line1 ? (
        <p className="text-xs font-medium text-foreground leading-tight">📍 {addr.line1}</p>
      ) : null}
      {addr.line2 ? (
        <p className="text-[11px] text-muted-foreground leading-tight">{addr.line2}</p>
      ) : null}
      {addr.detail ? (
        <p className="text-[11px] text-foreground/60 leading-tight">{addr.detail}</p>
      ) : null}
    </div>
  );
}
