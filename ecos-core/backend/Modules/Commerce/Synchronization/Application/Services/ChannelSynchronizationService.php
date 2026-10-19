<?php

declare(strict_types=1);

namespace Modules\Commerce\Synchronization\Application\Services;

use Illuminate\Support\Facades\Log;
use Modules\Commerce\ProductMappings\Domain\Models\ProductMapping;
use Modules\Commerce\Synchronization\Application\Jobs\InventorySyncJob;
use Modules\Inventory\DomainEvents\Contracts\DomainEvent;
use Modules\Inventory\InventoryItems\Domain\Models\InventoryItem;
use Modules\Inventory\Products\Domain\Models\Product;

/**
 * Phase B — Channel Synchronization Service.
 *
 * Orchestrates the domain-event → WooCommerce synchronization pipeline.
 *
 * Responsibilities (ADR-006 §Listener Strategy):
 *   1. Determine whether the event carries a product_id (session-level events do not).
 *   2. Resolve which channels are active and have sync_stock enabled.
 *   3. Verify a product mapping exists for each eligible channel.
 *   4. Compute the aggregate available stock across all warehouses.
 *   5. Dispatch one InventorySyncJob per channel, carrying the correlation ID and event metadata.
 *
 * This service MUST NOT contain inventory business logic.
 * This service MUST NOT create StockMovement records or modify stock balances.
 * This service MUST NOT know the internals of any channel adapter.
 *
 * Duplicate sync prevention:
 *   The legacy StockMovementObserver may also fire for paths that still create
 *   StockMovement records. Because InventorySyncJob pushes an absolute quantity to
 *   WooCommerce (idempotent PUT), dispatching the same quantity twice has no
 *   observable side-effect. No additional deduplication is required in Phase B.
 */
class ChannelSynchronizationService
{
    /**
     * Entry point called by InventoryChannelSynchronizationListener for every
     * received domain event. Silently no-ops for events without a product_id
     * (e.g. InventoryCountApproved, which is session-scoped).
     */
    public function handleEvent(DomainEvent $event): void
    {
        $payload = $event->toArray();

        $productId = $payload['product_id'] ?? null;
        $warehouseId = $payload['warehouse_id'] ?? null;

        if (! is_string($productId) || $productId === '') {
            // Session-level events (InventoryCountApproved) have no product_id.
            // Per-product adjustments inside the session each emit InventoryStockAdjusted
            // which DOES carry a product_id. Nothing to dispatch here.
            Log::channel('daily')->info('[ChannelSync] Skipping session-level event — no product_id', [
                'correlation_id' => $event->correlationId(),
                'event_name' => $event->eventName(),
                'event_version' => $event->eventVersion(),
            ]);

            return;
        }

        $product = Product::find($productId);

        if ($product === null) {
            Log::channel('daily')->warning('[ChannelSync] Product not found — skipping sync', [
                'correlation_id' => $event->correlationId(),
                'event_name' => $event->eventName(),
                'product_id' => $productId,
            ]);

            return;
        }

        // Aggregate on-hand qty across ALL warehouses so WooCommerce sees the correct
        // total (same approach as the legacy StockMovementObserver).
        $totalOnHand = (float) InventoryItem::query()
            ->where('product_id', $productId)
            ->sum('on_hand_qty');

        $dispatchCount = $this->dispatchToChannels($event, $product, $totalOnHand, $warehouseId);

        Log::channel('daily')->info('[ChannelSync] Event processed', [
            'correlation_id' => $event->correlationId(),
            'event_name' => $event->eventName(),
            'event_version' => $event->eventVersion(),
            'product_id' => $productId,
            'warehouse_id' => $warehouseId,
            'total_on_hand' => $totalOnHand,
            'jobs_dispatched' => $dispatchCount,
        ]);
    }

    // ── Private orchestration ─────────────────────────────────────────────────

    /**
     * Find every active channel with sync_stock enabled that has a mapping for
     * this product, then dispatch one InventorySyncJob per match.
     *
     * @return int number of jobs dispatched
     */
    private function dispatchToChannels(
        DomainEvent $event,
        Product $product,
        float $totalOnHand,
        ?string $warehouseId,
    ): int {
        $mappings = ProductMapping::query()
            ->with('channel.credential')
            ->where('product_id', $product->id)
            ->get();

        if ($mappings->isEmpty()) {
            return 0;
        }

        $dispatched = 0;

        foreach ($mappings as $mapping) {
            /** @var ProductMapping $mapping */
            $channel = $mapping->channel;

            if (! $this->shouldSync($channel)) {
                continue;
            }

            InventorySyncJob::dispatch(
                $channel,
                $product,
                $totalOnHand,
                $event->correlationId(),
                $event->eventName(),
                $event->eventVersion(),
                $warehouseId,
            );

            $dispatched++;
        }

        return $dispatched;
    }

    /**
     * Verify that a channel is eligible for stock synchronization.
     *
     * Rules (matching the legacy StockMovementObserver):
     *   - Channel must exist (not null / soft-deleted)
     *   - is_active must be true
     *   - sync_stock must be true
     */
    private function shouldSync(mixed $channel): bool
    {
        if ($channel === null) {
            return false;
        }

        return $channel->is_active === true
            && $channel->sync_stock === true;
    }
}
