<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TASK-ARCH-PRICE-001: Add Recipe Cost and yield_quantity to bills_of_materials.
 *
 * yield_quantity      — how many finished units this recipe produces per batch.
 * recipe_cost         — stored Recipe Cost = sum(component.material_cost × quantity).
 *                       Cached and recomputed whenever any component's material_cost changes.
 * recipe_cost_updated_at — timestamp of last cascade recalculation.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('bills_of_materials', 'yield_quantity')) {
            return;
        }

        Schema::table('bills_of_materials', function (Blueprint $table): void {
            $table->decimal('yield_quantity', 10, 4)->default(1.0)->after('notes');
            $table->decimal('recipe_cost', 15, 4)->nullable()->after('yield_quantity');
            $table->timestampTz('recipe_cost_updated_at')->nullable()->after('recipe_cost');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('bills_of_materials', 'yield_quantity')) {
            return;
        }

        Schema::table('bills_of_materials', function (Blueprint $table): void {
            $table->dropColumn(['yield_quantity', 'recipe_cost', 'recipe_cost_updated_at']);
        });
    }
};
