<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * TASK-BRAND-DELIVERY-WINDOWS-001
 *
 * Creates brand_delivery_time_slots — the canonical table for customer-facing
 * delivery time slots (e.g. "09:00–12:00", "12:00–15:00").
 *
 * Data is migrated from config_delivery_windows with IDs preserved so that
 * any existing orders.delivery_window_id references remain valid.
 *
 * Field mapping from old table:
 *   label      → name
 *   starts_at  → start_time
 *   ends_at    → end_time
 *   sort_order → display_order
 *   is_enabled → is_active
 *   company_id → (dropped — brand owns the record)
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('brand_delivery_time_slots')) {
            return;
        }

        Schema::create('brand_delivery_time_slots', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('brand_id')->constrained('brands')->cascadeOnDelete();
            $table->string('name', 100);
            $table->time('start_time');
            $table->time('end_time');
            $table->unsignedSmallInteger('display_order')->default(0);
            $table->boolean('is_active')->default(true);

            // Prepared for future use — not surfaced in UI yet
            $table->json('available_days')->nullable();   // e.g. ["sun","mon","tue"]
            $table->time('cutoff_time')->nullable();      // order cut-off for this slot

            $table->timestamps();

            $table->index(['brand_id', 'is_active'], 'idx_bdts_brand_active');
            $table->index(['brand_id', 'display_order'], 'idx_bdts_brand_order');
        });

        // Migrate existing data from config_delivery_windows (preserve IDs)
        if (Schema::hasTable('config_delivery_windows')) {
            DB::statement('
                INSERT INTO brand_delivery_time_slots
                    (id, brand_id, name, start_time, end_time, display_order, is_active, created_at, updated_at)
                SELECT
                    id,
                    brand_id,
                    label,
                    starts_at,
                    ends_at,
                    sort_order,
                    is_enabled,
                    created_at,
                    updated_at
                FROM config_delivery_windows
            ');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('brand_delivery_time_slots');
    }
};
