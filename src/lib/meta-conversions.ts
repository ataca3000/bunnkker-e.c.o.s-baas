import crypto from 'node:crypto';

type PurchaseEvent = {
  email?: string | null;
  value: number;
  currency?: string;
  eventId: string;
  eventTime?: number;
  sourceUrl?: string;
};

function sha256(value: string) {
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

export async function sendMetaPurchaseEvent({
  email,
  value,
  currency = 'USD',
  eventId,
  eventTime = Math.floor(Date.now() / 1000),
  sourceUrl,
}: PurchaseEvent) {
  const accessToken = process.env.META_CONVERSIONS_ACCESS_TOKEN;
  const pixelId = process.env.META_PIXEL_ID;

  if (!accessToken || !pixelId || !email || !Number.isFinite(value)) {
    return { sent: false, skipped: true };
  }

  const response = await fetch(`https://graph.facebook.com/v20.0/${pixelId}/events`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      data: [
        {
          event_name: 'Purchase',
          event_time: eventTime,
          event_id: eventId,
          action_source: 'website',
          event_source_url: sourceUrl,
          user_data: { em: [sha256(email)] },
          custom_data: { value, currency: currency.toUpperCase() },
        },
      ],
      access_token: accessToken,
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Meta Conversions API error (${response.status}): ${details}`);
  }

  return { sent: true, skipped: false };
}
