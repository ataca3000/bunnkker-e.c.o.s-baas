<?php

declare(strict_types=1);

namespace Modules\POS\Application\Listeners;

use Illuminate\Support\Facades\Log;
use Modules\Inventory\InventoryItems\Application\DTO\StockOperationDTO;
use Modules\Inventory\InventoryItems\Domain\Exceptions\InsufficientStockException;
use Modules\POS\Application\Contracts\StockIssuePortInterface;
use Modules\POS\Application\Events\SaleFinalized;
use Modules\POS\Application\Events\SaleItemPayload;
use Throwable;

/**
 * CRIT-003 — Decrements inventory for every line item when a POS sale completes.
 *
 * Subscriber 1 of 8. Listens to SaleFinalized (the enriched integration event).
 *
 * All context (warehouseId, companyId, items) is carried by the event —
 * no DB reloads are necessary (zero N+1 queries per subscriber).
 *
 * Negative-stock behaviour is governed by pos.inventory.allow_negative_stock:
 *   false (default) — logs an error and skips the decrement.
 *   true            — logs a warning and skips the decrement (stock goes implicit negative).
 *
 * The listener NEVER throws — the sale is already committed and must not roll back.
 * All failures are logged to the 'daily' channel for operational alerting.
 *
 * ADR-006 §Listener Strategy: one listener per consuming module, typed to the
 * concrete event class. No queue dispatch — Phase B will add async retry.
 */
final class PosSaleInventoryListener
{
    public function __construct(
        private readonly StockIssuePortInterface $stockIssue,
    ) {}

    public function handle(SaleFinalized $event): void
    {
        $allowNegative = (bool) config('pos.inventory.allow_negative_stock', false);

        foreach ($event->items as $item) {
            /** @var SaleItemPayload $item */
            try {
                $this->stockIssue->issue(new StockOperationDTO(
                    warehouse_id: $event->warehouseId,
                    product_id: $item->productId,
                    company_id: $event->companyId,
                    quantity: (float) $item->quantity,
                    reference_type: 'pos_sale',
                    reference_id: $event->saleId,
                    notes: "POS #{$event->receiptNumber} · {$item->productName}",
                ));
            } catch (InsufficientStockException $e) {
                $level = $allowNegative ? 'warning' : 'error';

                Log::channel('daily')->{$level}('[POS][Inventory] Insufficient stock — inventory not decremented', [
                    'sale_id' => $event->saleId,
                    'receipt_number' => $event->receiptNumber,
                    'product_id' => $item->productId,
                    'sku' => $item->sku,
                    'requested' => $item->quantity,
                    'error' => $e->getMessage(),
                ]);
            } catch (Throwable $e) {
                Log::channel('daily')->error('[POS][Inventory] Unexpected error decreasing inventory', [
                    'sale_id' => $event->saleId,
                    'product_id' => $item->productId,
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);
            }
        }
    }
}
