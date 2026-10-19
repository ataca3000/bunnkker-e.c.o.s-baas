<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Add cost_pending flag so the UI can immediately show ⚠ Missing Cost
        // without loading all line items.
        Schema::table('bills_of_materials', function (Blueprint $table): void {
            $table->boolean('cost_pending')->default(false)->after('cost_summary');
        });

        // Immutable audit log: every recalculation of a recipe's material cost.
        if (Schema::hasTable('recipe_cost_histories')) {
            return;
        }

        Schema::create('recipe_cost_histories', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('bom_id')->constrained('bills_of_materials')->cascadeOnDelete();
            $table->decimal('previous_materials_cost', 15, 4)->nullable();
            $table->decimal('new_materials_cost', 15, 4);
            $table->decimal('difference', 15, 4)->nullable();
            $table->string('trigger_type', 50);   // recipe_edit | material_cost_update
            $table->string('trigger_source')->nullable();
            $table->uuid('triggered_by')->nullable();
            $table->json('cost_snapshot')->nullable();
            $table->timestampTz('occurred_at');

            $table->index('bom_id');
            $table->index('occurred_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('recipe_cost_histories');
        Schema::table('bills_of_materials', function (Blueprint $table): void {
            $table->dropColumn('cost_pending');
        });
    }
};
