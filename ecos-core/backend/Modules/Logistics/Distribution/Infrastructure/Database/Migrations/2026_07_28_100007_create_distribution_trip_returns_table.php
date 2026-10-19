<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Unified return ledger.
 *
 * Replaces the previous driver_delivery_returns and driver_custody_returns.
 * Both modelled the same event — something coming back with the driver at end
 * of trip — and reconciled identically: dispatched vs returned, a discrepancy,
 * and a driver-liability flag. `kind` discriminates:
 *
 *   product → order_id + product_id + returned_qty
 *   custody → custody_type + dispatched_qty + returned_qty
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('distribution_trip_returns')) {
            return;
        }

        Schema::create('distribution_trip_returns', function (Blueprint $table) {
            $table->id();
            $table->foreignId('trip_id')->constrained('distribution_trips')->cascadeOnDelete();

            $table->string('kind', 20); // product | custody

            // ── Product returns ─────────────────────────────────────────────
            $table->uuid('order_id')->nullable();
            $table->foreign('order_id')->references('id')->on('orders')->cascadeOnDelete();
            $table->uuid('product_id')->nullable();
            $table->foreign('product_id')->references('id')->on('products')->cascadeOnDelete();
            $table->string('product_name', 255)->nullable();
            $table->string('disposition', 20)->nullable(); // full | partial

            // ── Custody returns ─────────────────────────────────────────────
            $table->string('custody_type', 40)->nullable();

            // ── Shared reconciliation ───────────────────────────────────────
            $table->decimal('dispatched_qty', 12, 3)->default(0);
            $table->decimal('returned_qty', 12, 3)->default(0);
            $table->decimal('warehouse_confirmed_qty', 12, 3)->nullable();
            $table->timestamp('warehouse_confirmed_at')->nullable();
            $table->foreignId('warehouse_confirmed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->decimal('discrepancy_qty', 12, 3)->nullable();
            $table->boolean('driver_liable')->default(false);

            $table->text('reason')->nullable();
            $table->json('photos')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('reported_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['trip_id', 'kind']);
            $table->index('driver_liable');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('distribution_trip_returns');
    }
};
