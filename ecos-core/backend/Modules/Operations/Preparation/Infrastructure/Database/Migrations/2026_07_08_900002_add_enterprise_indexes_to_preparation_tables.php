<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // preparation_waves composite index for daily planning queries
        // (warehouse_id, planning_date, status) — distinct from the single-column idx_preparation_waves_warehouse_id
        try {
            DB::statement('ALTER TABLE preparation_waves ADD INDEX idx_prep_waves_planning (warehouse_id, planning_date, status)');
        } catch (Exception $e) {
            // Index already exists — safe to skip
        }

        // preparation_waves brand+status composite (brand_id single-col index exists from 800000; this composite is new)
        try {
            DB::statement('ALTER TABLE preparation_waves ADD INDEX idx_prep_waves_brand_status (brand_id, status)');
        } catch (Exception $e) {
            // Index already exists — safe to skip
        }

        // preparation_wave_orders composite priority sorting
        // (preparation_priority single-col index exists from 800001; this composite with is_paid is new)
        try {
            DB::statement('ALTER TABLE preparation_wave_orders ADD INDEX idx_wave_orders_priority (preparation_priority, is_paid)');
        } catch (Exception $e) {
            // Index already exists — safe to skip
        }
    }

    public function down(): void
    {
        try {
            DB::statement('ALTER TABLE preparation_waves DROP INDEX idx_prep_waves_planning');
        } catch (Exception $e) {
        }
        try {
            DB::statement('ALTER TABLE preparation_waves DROP INDEX idx_prep_waves_brand_status');
        } catch (Exception $e) {
        }
        try {
            DB::statement('ALTER TABLE preparation_wave_orders DROP INDEX idx_wave_orders_priority');
        } catch (Exception $e) {
        }
    }
};
