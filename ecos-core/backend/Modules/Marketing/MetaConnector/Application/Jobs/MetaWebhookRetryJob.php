<?php

declare(strict_types=1);

namespace Modules\Marketing\MetaConnector\Application\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Modules\Marketing\MetaConnector\Application\Services\MetaWebhookService;
use Modules\Marketing\MetaConnector\Domain\Models\MetaWebhook;
use Throwable;

/**
 * Retries failed Meta webhook registrations.
 *
 * Dispatched on a schedule (daily) by MetaConnectorServiceProvider.
 * Finds all webhooks in 'failed' status and attempts re-registration.
 * Caps retries per run to avoid hammering Meta if there is a systemic issue.
 */
final class MetaWebhookRetryJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    private const MAX_RETRIES_PER_RUN = 20;

    public int $tries = 1;

    public int $timeout = 120;

    public function __construct() {}

    public function handle(MetaWebhookService $webhookService): void
    {
        $failed = MetaWebhook::where('status', 'failed')
            ->with('connection')
            ->limit(self::MAX_RETRIES_PER_RUN)
            ->get();

        if ($failed->isEmpty()) {
            return;
        }

        Log::info("MetaWebhookRetryJob: retrying {$failed->count()} failed webhooks.");

        foreach ($failed as $webhook) {
            if ($webhook->connection === null) {
                continue;
            }

            try {
                $webhookService->reRegister($webhook, $webhook->connection);
            } catch (Throwable $e) {
                Log::warning("MetaWebhookRetryJob: re-registration failed for webhook [{$webhook->id}]", [
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }
}
