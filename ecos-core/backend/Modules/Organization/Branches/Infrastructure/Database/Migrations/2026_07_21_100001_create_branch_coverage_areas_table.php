<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * TASK-BRANCH-ASSIGNMENT-ENGINE-001 — Branch coverage areas.
 *
 * Defines which governorates / zones each branch is responsible for.
 *
 * Coverage granularity:
 *   master_zone_id IS NULL  → branch covers the entire governorate
 *   master_zone_id IS NOT   → branch covers only that specific zone
 *
 * When multiple branches cover the same area, the engine selects the nearest
 * (by Haversine distance if lat/lng is available) or falls back to priority ASC.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('branch_coverage_areas')) {
            return;
        }

        Schema::create('branch_coverage_areas', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->foreignUuid('master_governorate_id')->constrained('master_governorates')->cascadeOnDelete();
            $table->char('master_zone_id', 36)->nullable();   // soft FK — no formal constraint to avoid cross-module coupling
            $table->smallInteger('priority')->default(100);   // lower = preferred when multiple candidates tie
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['branch_id', 'master_governorate_id', 'master_zone_id'], 'uq_bca_branch_gov_zone');
            $table->index(['master_governorate_id', 'is_active']);
            $table->index(['branch_id', 'is_active']);
        });

        DB::statement('CREATE INDEX idx_bca_zone_active ON branch_coverage_areas (master_zone_id, is_active)');
    }

    public function down(): void
    {
        Schema::dropIfExists('branch_coverage_areas');
    }
};
