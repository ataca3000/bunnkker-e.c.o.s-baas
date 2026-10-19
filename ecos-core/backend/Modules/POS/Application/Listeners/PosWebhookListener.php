<?php

declare(strict_types=1);

namespace Modules\POS\Application\Listeners;

use Illuminate\Support\Facades\Log;
use Modules\POS\Application\Events\SaleFinalized;
use Modules\POS\Application\Jobs\DispatchWebhookJob;
use Throwable;

/**
 * Subscriber 8 — Integration / Webhook
 *
 * Dispatches the completed sale to all configured external webhook endpoints.
 *
 * Responsibilities:
 *   - Publish SaleFinalized payload to ERP integrations.
 *   - Publish to external BI platforms, AI platforms, data warehouses.
 *   - Publish to custom webhook subscribers.
 *
 * Configuration:
 *   `pos.webhooks.endpoints` — array of URL strings.
 *   Each endpoint receives its own queued DispatchWebhookJob (independent failures).
 *
 * The listener itself is synchronous (fast); all HTTP delivery is queued.
 * This listener NEVER blocks the checkout response.
 *
 * Security:
 *   HMAC signing via `pos.webhooks.secret` (see DispatchWebhookJob).
 *
 * Idempotency:
 *   Each job carries `idempotency_key = eventId`. Receiving endpoints must
 *   deduplicate on this key. Job retries re-send the same idempotency_key.
 *
 * Extension:
 *   To add a new integration target, add its URL to `pos.webhooks.endpoints`.
 *   No code changes required.
 *
 * Safety: NEVER throws — the sale is already committed and must not be affected.
 */
final class PosWebhookListener
{
    public function handle(SaleFinalized $event): void
    {
        /** @var string[] $endpoints */
        $endpoints = config('pos.webhooks.endpoints', []);

        if (empty($endpoints)) {
            return;
        }

        $payload = $event->toArray();

        foreach ($endpoints as $url) {
            if (! filter_var($url, FILTER_VALIDATE_URL)) {
                Log::channel('daily')->warning('[POS][Webhook] Invalid endpoint URL skipped', [
                    'url' => $url,
                    'sale_id' => $event->saleId,
                ]);

                continue;
            }

            try {
                DispatchWebhookJob::dispatch(
                    endpointUrl: $url,
                    eventName: $event->eventName(),
                    idempotencyKey: $event->eventId(),
                    payload: $payload,
                );
            } catch (Throwable $e) {
                Log::channel('daily')->error('[POS][Webhook] Failed to dispatch webhook job', [
                    'url' => $url,
                    'sale_id' => $event->saleId,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }
}
