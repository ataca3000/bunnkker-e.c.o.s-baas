<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TASK-ARCH-PRICE-001 Part 4 — Price History.
 *
 * Every Material Cost change creates one record here.
 * Stores: previous cost, new cost, difference, source, affected recipes/products.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('material_cost_history')) {
            return;
        }

        Schema::create('material_cost_history', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            // Which product's material_cost changed
            $table->uuid('product_id');
            $table->foreign('product_id')->references('id')->on('products')->cascadeOnDelete();

            // The cost change itself
            $table->decimal('previous_cost', 15, 4)->nullable();
            $table->decimal('new_cost', 15, 4);
            $table->decimal('difference', 15, 4);         // new_cost − previous_cost
            $table->decimal('change_pct', 8, 4)->nullable(); // null when previous_cost is null

            // Update source
            $table->string('source', 30);                    // 'manual' | 'purchase_invoice'
            $table->uuid('goods_receipt_id')->nullable();    // set when source='purchase_invoice'

            // Actor
            $table->string('updated_by')->nullable();        // user name or ID

            // Cascade impact (stored as JSON arrays of UUIDs)
            $table->json('affected_recipe_ids')->nullable();
            $table->json('affected_product_ids')->nullable();

            $table->timestampTz('occurred_at');
            $table->timestampTz('created_at')->useCurrent();

            // Indexes for common queries
            $table->index('product_id');
            $table->index('occurred_at');
            $table->index('source');
            $table->index('goods_receipt_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('material_cost_history');
    }
};
