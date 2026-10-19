<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TASK-COST-ARCH-002 — Add cost_summary JSON and packaging_cost to bills_of_materials.
 *
 * cost_summary   — full RecipeCostSummaryDTO serialized as JSON (authoritative breakdown).
 * packaging_cost — denormalized float for fast filtering/sorting on packaging cost.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('bills_of_materials', 'packaging_cost')) {
            return;
        }

        Schema::table('bills_of_materials', function (Blueprint $table): void {
            $table->decimal('packaging_cost', 15, 4)->nullable()->after('recipe_cost');
            $table->json('cost_summary')->nullable()->after('packaging_cost');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('bills_of_materials', 'packaging_cost')) {
            return;
        }

        Schema::table('bills_of_materials', function (Blueprint $table): void {
            $table->dropColumn(['packaging_cost', 'cost_summary']);
        });
    }
};
