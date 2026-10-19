<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * TASK-ORDER-LIFECYCLE-001 — ADR status consolidation.
 *
 * Maps removed/renamed statuses to their final-lifecycle equivalents:
 *   in_progress          → processing   (merged into processing)
 *   confirm_order        → confirmed    (renamed)
 *   needs_shipping_review → review      (generalized)
 *   ready_for_loading    → preparing    (vehicle-load prep consolidates into preparing)
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('orders')->where('status', 'in_progress')->update(['status' => 'processing']);
        DB::table('orders')->where('status', 'confirm_order')->update(['status' => 'confirmed']);
        DB::table('orders')->where('status', 'needs_shipping_review')->update(['status' => 'review']);
        DB::table('orders')->where('status', 'ready_for_loading')->update(['status' => 'preparing']);
    }

    public function down(): void
    {
        // Not reversible — old enum values are removed from the application.
    }
};
