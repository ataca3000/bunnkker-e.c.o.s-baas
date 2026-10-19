<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * ARCH-001 — Remove legacy "in_progress" order status.
 *
 * The 2026_07_13_000001 migration already converted all in_progress → processing.
 * This supplemental pass defends against any rows that may have been re-created
 * after that migration ran (e.g. via the old API validation that still accepted
 * in_progress as a valid status input until TASK-ORD-HARDENING-001 removed it).
 *
 * After this migration OrderStatus::InProgress is removed from the PHP enum;
 * any remaining in_progress value in the database would throw ValueError on model
 * load.  This migration ensures the column constraint is clean before the enum
 * case is deleted.
 */
return new class extends Migration
{
    public function up(): void
    {
        $converted = DB::table('orders')
            ->where('status', 'in_progress')
            ->update(['status' => 'processing', 'updated_at' => now()]);

        if ($converted > 0) {
            Illuminate\Support\Facades\Log::warning(
                "[ARCH-001] Converted {$converted} legacy in_progress order(s) to processing.",
            );
        }
    }

    public function down(): void
    {
        // Intentionally not reversible — in_progress is not a valid status.
    }
};
