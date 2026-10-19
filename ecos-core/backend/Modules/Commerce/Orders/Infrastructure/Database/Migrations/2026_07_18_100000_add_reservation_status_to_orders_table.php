<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * TASK-INV-RESERVATION-LIFECYCLE-001
 *
 * Adds the canonical reservation_status field to the orders table.
 * This is the single source of truth for the reservation state machine,
 * independent of order_status and the legacy inventory_*_at timestamps.
 *
 * States: pending | reserved | partial_reserved | awaiting_stock |
 *         released | transferred | consumed | failed
 *
 * Also adds reservation_failure_reason for human-readable failure context.
 *
 * Backfills reservation_status for all existing orders based on the
 * legacy timestamp fields so the column is never null after migration.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('orders', 'reservation_status')) {
            return;
        }

        Schema::table('orders', static function (Blueprint $table): void {
            $table->string('reservation_status', 30)
                ->nullable()
                ->default(null)
                ->after('inventory_released_at')
                ->comment('Canonical reservation lifecycle: pending|reserved|partial_reserved|awaiting_stock|released|transferred|consumed|failed');

            $table->string('reservation_failure_reason', 500)
                ->nullable()
                ->after('reservation_status')
                ->comment('Human-readable reason for awaiting_stock or failed states');
        });

        // ── Backfill existing orders ──────────────────────────────────────────
        // Orders with shipped inventory → transferred (vehicle loading already done)
        DB::statement("
            UPDATE orders
            SET reservation_status = 'transferred'
            WHERE inventory_shipped_at IS NOT NULL
              AND reservation_status IS NULL
              AND deleted_at IS NULL
        ");

        // Orders with released reservation → released
        DB::statement("
            UPDATE orders
            SET reservation_status = 'released'
            WHERE inventory_released_at IS NOT NULL
              AND reservation_status IS NULL
              AND deleted_at IS NULL
        ");

        // Delivered/Completed orders with shipped inventory → consumed
        DB::statement("
            UPDATE orders
            SET reservation_status = 'consumed'
            WHERE status IN ('delivered', 'completed')
              AND inventory_shipped_at IS NOT NULL
              AND reservation_status IS NULL
              AND deleted_at IS NULL
        ");

        // Orders currently awaiting_stock → awaiting_stock
        DB::statement("
            UPDATE orders
            SET reservation_status = 'awaiting_stock'
            WHERE status = 'awaiting_stock'
              AND reservation_status IS NULL
              AND deleted_at IS NULL
        ");

        // Orders with active reservation (not released, not shipped) → reserved
        DB::statement("
            UPDATE orders
            SET reservation_status = 'reserved'
            WHERE inventory_reserved_at IS NOT NULL
              AND inventory_released_at IS NULL
              AND inventory_shipped_at IS NULL
              AND reservation_status IS NULL
              AND deleted_at IS NULL
        ");

        // All remaining orders → pending
        DB::statement("
            UPDATE orders
            SET reservation_status = 'pending'
            WHERE reservation_status IS NULL
              AND deleted_at IS NULL
        ");
    }

    public function down(): void
    {
        if (Schema::hasColumn('orders', 'reservation_status')) {
            return;
        }

        Schema::table('orders', static function (Blueprint $table): void {
            $table->dropColumn(['reservation_status', 'reservation_failure_reason']);
        });
    }
};
