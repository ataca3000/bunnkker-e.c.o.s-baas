<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * TASK-ORDERS-LIFECYCLE-ARCH-002 — V3 Order Status Lifecycle.
 *
 * Renames status values in the orders table to match the new 11-status lifecycle:
 *   pending       → new
 *   processing    → in_progress
 *   confirmed     → in_progress  (merged: was a separate confirmation step)
 *   preparing     → in_progress  (invisible engine state; order remains In Progress)
 *   review        → on_hold
 *   rescheduled   → on_hold      (rescheduling is now a Shipping OS concern)
 *   completed     → delivered    (Delivered is now the final fulfilled state)
 *
 * Adds customer verification columns (informational, non-blocking).
 */
return new class extends Migration
{
    public function up(): void
    {
        // ── Step 1: Rename status values ──────────────────────────────────────
        DB::statement("UPDATE orders SET status = 'new' WHERE status = 'pending'");
        DB::statement("UPDATE orders SET status = 'in_progress' WHERE status IN ('processing', 'confirmed', 'preparing')");
        DB::statement("UPDATE orders SET status = 'on_hold' WHERE status IN ('review', 'rescheduled')");
        DB::statement("UPDATE orders SET status = 'delivered' WHERE status = 'completed'");
        // Unchanged: out_for_delivery, awaiting_payment, awaiting_stock, scheduled, cancelled, returned, delivered

        // ── Step 2: Add customer verification columns ─────────────────────────
        Schema::table('orders', function (Blueprint $table): void {
            $table->timestamp('customer_verified_at')->nullable();
            $table->string('customer_verified_by')->nullable();
            $table->text('customer_verification_notes')->nullable();
        });
    }

    public function down(): void
    {
        // Best-effort reversal — merged statuses cannot be split back exactly.
        DB::statement("UPDATE orders SET status = 'pending' WHERE status = 'new'");
        DB::statement("UPDATE orders SET status = 'processing' WHERE status = 'in_progress'");
        DB::statement("UPDATE orders SET status = 'review' WHERE status = 'on_hold'");
        DB::statement("UPDATE orders SET status = 'completed' WHERE status = 'delivered'");

        Schema::table('orders', function (Blueprint $table): void {
            $table->dropColumn(['customer_verified_at', 'customer_verified_by', 'customer_verification_notes']);
        });
    }
};
