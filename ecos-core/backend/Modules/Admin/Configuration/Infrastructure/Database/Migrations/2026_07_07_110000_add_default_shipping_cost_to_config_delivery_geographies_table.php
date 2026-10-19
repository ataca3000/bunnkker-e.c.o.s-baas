<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * TASK-CONFIG-OS-003 PART 4 — Governorate-level default shipping cost.
 *
 * Every governorate owned by a brand has one default shipping price.
 * Delivery zones inherit this price unless a zone-level override
 * exists in config_brand_shipping_rules.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE config_delivery_geographies ADD COLUMN default_shipping_cost DECIMAL(10,2) NULL AFTER is_active');
    }

    public function down(): void
    {
        if (Schema::hasColumn('config_delivery_geographies', 'default_shipping_cost')) {
            DB::statement('ALTER TABLE config_delivery_geographies DROP COLUMN default_shipping_cost');
        }
    }
};
