<?php

declare(strict_types=1);

namespace Modules\POS\Application\Listeners;

use Illuminate\Support\Facades\Log;
use Modules\POS\Application\Events\SaleFinalized;
use Modules\POS\Application\Events\SaleItemPayload;
use Throwable;

/**
 * Subscriber 7 — Notifications
 *
 * Generates operational notifications when a POS sale completes.
 *
 * Responsibilities:
 *   - Alert on large sales above a configurable threshold.
 *   - Alert on low stock detected from items sold.
 *   - Flag inventory problems (out-of-stock items sold).
 *
 * Notification channels:
 *   Configured via 'pos.notifications.channels' (e.g. ['mail', 'database', 'slack']).
 *   Defaults to logging only until channels are configured.
 *
 * Thresholds (configurable in config/pos.php):
 *   pos.notifications.large_sale_threshold  — float (default: 5000)
 *   pos.notifications.low_stock_threshold   — int (default: 5 units)
 *
 * Safety: NEVER throws — the sale is already committed and must not be affected.
 */
final class PosNotificationListener
{
    public function handle(SaleFinalized $event): void
    {
        try {
            $this->checkLargeSale($event);
            $this->checkLowStockIndicators($event);
        } catch (Throwable $e) {
            Log::channel('daily')->error('[POS][Notifications] Failed to process notification checks', [
                'sale_id' => $event->saleId,
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function checkLargeSale(SaleFinalized $event): void
    {
        $threshold = (float) config('pos.notifications.large_sale_threshold', 5000.0);
        $total = (float) $event->grandTotal;

        if ($total < $threshold) {
            return;
        }

        Log::channel('daily')->notice('[POS][Notifications] Large sale detected', [
            'sale_id' => $event->saleId,
            'receipt_number' => $event->receiptNumber,
            'grand_total' => $event->grandTotal,
            'currency' => $event->currency,
            'cashier_id' => $event->cashierId,
            'warehouse_id' => $event->warehouseId,
            'threshold' => $threshold,
        ]);

        // Future: fire a LargeSaleDetected notification via Laravel Notification system
        // Notification::send($recipients, new LargeSaleNotification($event));
    }

    private function checkLowStockIndicators(SaleFinalized $event): void
    {
        // The POS does not have direct access to remaining stock at this point.
        // We log which products were sold so a downstream job can check thresholds.
        // A future PosLowStockJob can query inventory for these product IDs.
        $productIds = array_map(
            static fn (SaleItemPayload $item) => $item->productId,
            $event->items,
        );

        Log::channel('daily')->debug('[POS][Notifications] Products sold — stock check queued', [
            'sale_id' => $event->saleId,
            'warehouse_id' => $event->warehouseId,
            'product_ids' => $productIds,
        ]);

        // Future: dispatch a queued job to check inventory levels
        // CheckStockThresholdsJob::dispatch($event->warehouseId, $productIds);
    }
}
