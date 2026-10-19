<?php

declare(strict_types=1);

namespace Modules\POS\Application\Listeners;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Modules\POS\Application\Events\SaleFinalized;
use Throwable;

/**
 * Subscriber 4 — Customer Statistics
 *
 * Updates the POS customer statistics table when a sale completes.
 *
 * Responsibilities:
 *   - Increment total lifetime spend
 *   - Increment order count
 *   - Update last purchase timestamp
 *
 * Storage:
 *   Uses `pos_customer_stats` (separate from `customers`) so we can track
 *   POS-specific stats without coupling to the Sales\Customers domain model.
 *   See migration: create_pos_customer_stats_table.
 *
 * Idempotency:
 *   The `last_pos_sale_id` column acts as an idempotency key.
 *   If the same saleId appears again (retry), the WHERE clause prevents a
 *   double-increment via a PostgreSQL conditional upsert.
 *
 * Safety: NEVER throws — the sale is already committed and must not be affected.
 */
final class PosCustomerListener
{
    public function handle(SaleFinalized $event): void
    {
        if (! $event->hasCustomer()) {
            return;
        }

        try {
            $this->upsertStats($event);
        } catch (Throwable $e) {
            Log::channel('daily')->error('[POS][Customer] Failed to update customer statistics', [
                'sale_id' => $event->saleId,
                'customer_id' => $event->customerId,
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function upsertStats(SaleFinalized $event): void
    {
        // PostgreSQL conditional upsert: only increment when the sale_id
        // has not already been processed (idempotency guard).
        DB::statement(
            <<<'SQL'
            INSERT INTO pos_customer_stats
                (customer_id, total_spent, order_count, last_pos_sale_id, last_purchase_at, created_at, updated_at)
            VALUES
                (:customer_id, :amount, 1, :sale_id, :purchased_at, NOW(), NOW())
            ON CONFLICT (customer_id) DO UPDATE
            SET
                total_spent     = pos_customer_stats.total_spent + EXCLUDED.total_spent,
                order_count     = pos_customer_stats.order_count + 1,
                last_pos_sale_id = EXCLUDED.last_pos_sale_id,
                last_purchase_at = EXCLUDED.last_purchase_at,
                updated_at       = NOW()
            WHERE pos_customer_stats.last_pos_sale_id IS DISTINCT FROM EXCLUDED.last_pos_sale_id
            SQL,
            [
                'customer_id' => $event->customerId,
                'amount' => $event->grandTotal,
                'sale_id' => $event->saleId,
                'purchased_at' => $event->occurredAt()->format('Y-m-d H:i:s'),
            ],
        );

        Log::channel('daily')->info('[POS][Customer] Statistics updated', [
            'customer_id' => $event->customerId,
            'sale_id' => $event->saleId,
            'spent' => $event->grandTotal,
        ]);
    }
}
