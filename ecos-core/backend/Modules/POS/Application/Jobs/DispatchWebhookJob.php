<?php

declare(strict_types=1);

namespace Modules\POS\Application\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Queued job: delivers a POS webhook payload to a configured endpoint.
 *
 * Each webhook endpoint gets its own job instance so failures are independent —
 * one failing endpoint does not prevent delivery to others.
 *
 * Idempotency:
 *   The payload always includes `idempotency_key` (= eventId of SaleFinalized).
 *   Receiving systems should deduplicate on this key.
 *
 * Retry policy:
 *   - Laravel's default queue retry handles transient failures.
 *   - maxTries = 3, backoff seconds: [30, 120, 300].
 *   - On final failure, logs to 'daily' channel with full context.
 *
 * Security:
 *   Signing header `X-ECOS-Signature: sha256=<hmac>` is sent when
 *   `pos.webhooks.secret` is configured, allowing receivers to verify authenticity.
 */
final class DispatchWebhookJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $timeout = 30;

    /** @var int[] */
    public array $backoff = [30, 120, 300];

    public function __construct(
        private readonly string $endpointUrl,
        private readonly string $eventName,
        private readonly string $idempotencyKey,
        private readonly array $payload,
    ) {}

    public function handle(): void
    {
        $secret = config('pos.webhooks.secret');
        $body = json_encode($this->payload, JSON_THROW_ON_ERROR);
        $headers = [
            'Content-Type' => 'application/json',
            'X-ECOS-Event' => $this->eventName,
            'X-Idempotency-Key' => $this->idempotencyKey,
        ];

        if ($secret) {
            $headers['X-ECOS-Signature'] = 'sha256='.hash_hmac('sha256', $body, (string) $secret);
        }

        $response = Http::withHeaders($headers)
            ->timeout($this->timeout)
            ->post($this->endpointUrl, $this->payload);

        if ($response->failed()) {
            Log::channel('daily')->warning('[POS][Webhook] Delivery failed — will retry', [
                'url' => $this->endpointUrl,
                'event_name' => $this->eventName,
                'idempotency_key' => $this->idempotencyKey,
                'status' => $response->status(),
                'attempt' => $this->attempts(),
            ]);

            $this->release(
                $this->backoff[$this->attempts() - 1] ?? 300,
            );

            return;
        }

        Log::channel('daily')->info('[POS][Webhook] Delivered successfully', [
            'url' => $this->endpointUrl,
            'event_name' => $this->eventName,
            'idempotency_key' => $this->idempotencyKey,
            'status' => $response->status(),
        ]);
    }

    public function failed(Throwable $e): void
    {
        Log::channel('daily')->error('[POS][Webhook] Final delivery failure', [
            'url' => $this->endpointUrl,
            'event_name' => $this->eventName,
            'idempotency_key' => $this->idempotencyKey,
            'error' => $e->getMessage(),
        ]);
    }
}
