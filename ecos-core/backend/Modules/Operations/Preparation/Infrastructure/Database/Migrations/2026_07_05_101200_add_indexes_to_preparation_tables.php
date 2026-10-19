<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('preparation_waves', function (Blueprint $table): void {
            $table->index(['company_id', 'status'], 'idx_preparation_waves_company_status');
            $table->index(['company_id', 'planning_date'], 'idx_preparation_waves_company_planning_date');
            $table->index('warehouse_id', 'idx_preparation_waves_warehouse_id');
        });

        Schema::table('preparation_wave_items', function (Blueprint $table): void {
            $table->index(['preparation_wave_id', 'status'], 'idx_preparation_wave_items_wave_status');
        });

        Schema::table('preparation_material_requirements', function (Blueprint $table): void {
            $table->index(['preparation_wave_id', 'shortage'], 'idx_prep_material_req_wave_shortage');
        });

        Schema::table('preparation_pick_list_items', function (Blueprint $table): void {
            $table->index(['pick_list_id', 'status'], 'idx_pick_list_items_status');
        });

        Schema::table('preparation_wave_workers', function (Blueprint $table): void {
            $table->index(['preparation_wave_id', 'user_id'], 'idx_wave_workers_active');
        });

        Schema::table('preparation_exceptions', function (Blueprint $table): void {
            $table->index(['preparation_wave_id', 'status'], 'idx_prep_exceptions_wave_status');
            $table->index(['severity', 'status'], 'idx_prep_exceptions_severity_status');
        });

        Schema::table('prepared_products_pool', function (Blueprint $table): void {
            $table->index(['warehouse_id', 'quality_status'], 'idx_pool_warehouse_quality');
            $table->index('reserved_for_wave_id', 'idx_pool_reserved_for_wave');
        });
    }

    public function down(): void
    {
        Schema::table('preparation_waves', function (Blueprint $table): void {
            $table->dropIndex('idx_preparation_waves_company_status');
            $table->dropIndex('idx_preparation_waves_company_planning_date');
            $table->dropIndex('idx_preparation_waves_warehouse_id');
        });

        Schema::table('preparation_wave_items', function (Blueprint $table): void {
            $table->dropIndex('idx_preparation_wave_items_wave_status');
        });

        Schema::table('preparation_material_requirements', function (Blueprint $table): void {
            $table->dropIndex('idx_prep_material_req_wave_shortage');
        });

        Schema::table('preparation_pick_list_items', function (Blueprint $table): void {
            $table->dropIndex('idx_pick_list_items_status');
        });

        Schema::table('preparation_wave_workers', function (Blueprint $table): void {
            $table->dropIndex('idx_wave_workers_active');
        });

        Schema::table('preparation_exceptions', function (Blueprint $table): void {
            $table->dropIndex('idx_prep_exceptions_wave_status');
            $table->dropIndex('idx_prep_exceptions_severity_status');
        });

        Schema::table('prepared_products_pool', function (Blueprint $table): void {
            $table->dropIndex('idx_pool_warehouse_quality');
            $table->dropIndex('idx_pool_reserved_for_wave');
        });
    }
};
