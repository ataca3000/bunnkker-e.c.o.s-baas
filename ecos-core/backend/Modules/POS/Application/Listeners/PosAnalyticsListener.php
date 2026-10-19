<?php

declare(strict_types=1);

namespace Modules\POS\Application\Listeners;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Modules\POS\Application\Events\SaleFinalized;
use Modules\POS\Application\Events\SaleItemPayload;
use Throwable;

/**
 * Subscriber 6 — Analytics
 *
 * Persists structured analytics events when a POS sale completes.
 *
 * Responsibilities:
 *   - Record a sale-level analytics event (daily sales, channel performance).
 *   - Record per-product analytics events (product sales, category performance).
 *   - Record cashier performance data.
 *
 * Storage:
 *   `pos_analytics_events` table with JSONB payload.
 *   See migration: create_pos_analytics_events_table.
 *
 * Idempotency:
 *   Unique constraint on (sale_id, event_type) prevents duplicate rows.
 *   Uses INSERT ... ON CONFLICT DO NOTHING — safe to retry.
 *
 * Performance:
 *   All inserts are batched into a single transaction. Analytics must never
 *   slow checkout — if this listener fails, the sale is unaffected.
 *
 * Safety: NEVER throws — the sale is already committed and must not be affected.
 */
final class PosAnalyticsListener
{
    public function handle(SaleFinalized $event): void
    {
        try {
            DB::transaction(function () use ($event): void {
                $this->insertSaleEvent($event);
                $this->insertProductEvents($event);
                $this->insertCashierEvent($event);
            });
        } catch (Throwable $e) {
            Log::channel('daily')->error('[POS][Analytics] Failed to record analytics events', [
                'sale_id' => $event->saleId,
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function insertSaleEvent(SaleFinalized $event): void
    {
        DB::table('pos_analytics_events')->insertOrIgnore([
            'event_id' => $event->eventId(),
            'event_type' => 'sale_completed',
            'sale_id' => $event->saleId,
            'company_id' => $event->companyId,
            'warehouse_id' => $event->warehouseId,
            'channel_id' => $event->channelId,
            'cashier_id' => $event->cashierId,
            'customer_id' => $event->customerId,
            'payload' => json_encode([
                'receipt_number' => $event->receiptNumber,
                'grand_total' => $event->grandTotal,
                'subtotal' => $event->subtotal,
                'discount_total' => $event->discountTotal,
                'amount_paid' => $event->amountPaid,
                'change_given' => $event->changeGiven,
                'currency' => $event->currency,
                'item_count' => count($event->items),
                'total_units' => $event->totalUnits(),
                'payments' => array_map(
                    static fn ($p) => ['method' => $p->method, 'amount' => $p->amount],
                    $event->payments,
                ),
            ], JSON_THROW_ON_ERROR),
            'occurred_at' => $event->occurredAt()->format('Y-m-d H:i:s'),
            'created_at' => now(),
        ]);
    }

    private function insertProductEvents(SaleFinalized $event): void
    {
        $rows = array_map(
            function (SaleItemPayload $item) use ($event): array {
                return [
                    'event_id' => $this->generateUuid(),
                    'event_type' => 'product_sold',
                    'sale_id' => $event->saleId,
                    'company_id' => $event->companyId,
                    'warehouse_id' => $event->warehouseId,
                    'channel_id' => $event->channelId,
                    'cashier_id' => $event->cashierId,
                    'customer_id' => $event->customerId,
                    'payload' => json_encode([
                        'product_id' => $item->productId,
                        'product_name' => $item->productName,
                        'sku' => $item->sku,
                        'quantity' => $item->quantity,
                        'unit_price' => $item->unitPrice,
                        'line_total' => $item->lineTotal,
                        'currency' => $item->currency,
                        'receipt_number' => $event->receiptNumber,
                    ], JSON_THROW_ON_ERROR),
                    'occurred_at' => $event->occurredAt()->format('Y-m-d H:i:s'),
                    'created_at' => now(),
                ];
            },
            $event->items,
        );

        if (! empty($rows)) {
            DB::table('pos_analytics_events')->insertOrIgnore($rows);
        }
    }

    private function insertCashierEvent(SaleFinalized $event): void
    {
        DB::table('pos_analytics_events')->insertOrIgnore([
            'event_id' => $this->generateUuid(),
            'event_type' => 'cashier_sale',
            'sale_id' => $event->saleId,
            'company_id' => $event->companyId,
            'warehouse_id' => $event->warehouseId,
            'channel_id' => $event->channelId,
            'cashier_id' => $event->cashierId,
            'customer_id' => $event->customerId,
            'payload' => json_encode([
                'receipt_number' => $event->receiptNumber,
                'grand_total' => $event->grandTotal,
                'currency' => $event->currency,
                'item_count' => count($event->items),
                'session_id' => $event->sessionId,
                'shift_id' => $event->shiftId,
            ], JSON_THROW_ON_ERROR),
            'occurred_at' => $event->occurredAt()->format('Y-m-d H:i:s'),
            'created_at' => now(),
        ]);
    }

    private function generateUuid(): string
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0F) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3F) | 0x80);

        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
    }
}
