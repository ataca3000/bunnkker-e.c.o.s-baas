<?php

declare(strict_types=1);

namespace Modules\Commerce\Synchronization\Application\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Modules\Commerce\Channels\Domain\Models\Channel;
use Modules\Commerce\ProductMappings\Domain\Models\ProductMapping;
use Modules\Commerce\StockSync\Application\Services\WooCommerceStockSyncer;
use Modules\Commerce\Synchronization\Application\Services\SyncLogService;
use Modules\Commerce\Synchronization\Domain\Enums\SyncDirection;
use Modules\Commerce\Synchronization\Domain\Enums\SyncEntityType;
use Modules\Commerce\Synchronization\Domain\Enums\SyncStatus;
use Modules\Inventory\Products\Domain\Models\Product;
use Throwable;

final class InventorySyncJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $backoff = 60;

    public function __construct(
        private readonly Channel $channel,
        private readonly Product $product,
        private readonly float $stockQuantity,
        // ── Phase B: correlation and event metadata ───────────────────────────
        private readonly ?string $correlationId = null,
        private readonly ?string $eventName = null,
        private readonly ?int $eventVersion = null,
        private readonly ?string $warehouseId = null,
    ) {
        // Ensure this job only runs after the DB transaction that recorded the stock
        // movement has committed. Without this, the queue worker could read stale data.
        $this->afterCommit = true;
    }

    public function handle(SyncLogService $logService, WooCommerceStockSyncer $syncer): void
    {
        $startedAt = hrtime(true);

        $log = $logService->createLog(
            channel: $this->channel,
            entityType: SyncEntityType::Inventory,
            direction: SyncDirection::Outbound,
            action: 'inventory.sync',
            entityId: $this->product->id,
            status: SyncStatus::Processing,
            requestPayload: [
                'product_id' => $this->product->id,
                'stock_quantity' => $this->stockQuantity,
            ],
            correlationId: $this->correlationId,
            eventName: $this->eventName,
            eventVersion: $this->eventVersion,
            warehouseId: $this->warehouseId,
        );

        $mapping = ProductMapping::query()
            ->where('product_id', $this->product->id)
            ->where('channel_id', $this->channel->id)
            ->first();

        if ($mapping === null) {
            $logService->markFailed($log, 'No product mapping found for this channel.');
            $this->logStructured('failed', 'no_mapping', null, $startedAt);

            return;
        }

        $credential = $this->channel->credential;

        if ($credential === null) {
            $logService->markFailed($log, 'No credentials configured for this channel.');
            $this->logStructured('failed', 'no_credentials', null, $startedAt);

            return;
        }

        try {
            $success = $syncer->updateStock(
                $this->channel->store_url,
                $credential->consumer_key,
                $credential->consumer_secret,
                $mapping->external_product_id,
                $this->stockQuantity,
            );

            $durationMs = $this->elapsedMs($startedAt);

            if ($success) {
                $logService->markSuccess($log, ['stock_quantity' => $this->stockQuantity], $this->channel, $durationMs);
                $this->logStructured('success', null, $durationMs, $startedAt);
            } else {
                $logService->markFailed($log, 'WooCommerce stock update request failed.', null, $this->channel, $durationMs);
                $this->logStructured('failed', 'api_rejected', $durationMs, $startedAt);
            }
        } catch (Throwable $e) {
            $durationMs = $this->elapsedMs($startedAt);
            $logService->markFailed($log, $e->getMessage(), null, $this->channel, $durationMs);
            $this->logStructured('failed', $e->getMessage(), $durationMs, $startedAt);
            throw $e;
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function logStructured(string $result, ?string $error, ?int $durationMs, int $startedAt): void
    {
        Log::channel('daily')->info('[InventorySyncJob] Completed', [
            'correlation_id' => $this->correlationId,
            'event_name' => $this->eventName,
            'event_version' => $this->eventVersion,
            'channel' => $this->channel->name,
            'product' => $this->product->id,
            'warehouse' => $this->warehouseId,
            'direction' => SyncDirection::Outbound->value,
            'result' => $result,
            'error' => $error,
            'duration_ms' => $durationMs ?? $this->elapsedMs($startedAt),
        ]);
    }

    private function elapsedMs(int $startedAt): int
    {
        return (int) round((hrtime(true) - $startedAt) / 1_000_000);
    }
}
