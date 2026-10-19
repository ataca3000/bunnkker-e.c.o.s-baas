<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TASK-ARCH-PRICE-001 Part 5 & 7 — Price Review Center queue.
 *
 * When Product Cost changes, the system creates one pricing_review per
 * product × company × channel combination. Selling Price is NEVER touched
 * automatically — management decides through this review queue.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('pricing_reviews')) {
            return;
        }

        Schema::create('pricing_reviews', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            $table->uuid('product_id');
            $table->foreign('product_id')->references('id')->on('products')->cascadeOnDelete();

            // Scope
            $table->string('company_id', 36);
            $table->string('channel_id', 36)->nullable(); // null = applies to all channels

            // Cost snapshot at review creation time
            $table->decimal('product_cost', 15, 4); // new Product Cost
            $table->decimal('previous_product_cost', 15, 4)->nullable();
            $table->decimal('cost_difference', 15, 4)->default(0);

            // Selling price context
            $table->decimal('selling_price', 15, 4); // current selling price
            $table->decimal('suggested_selling_price', 15, 4); // cost / (1 - target_margin)
            $table->decimal('target_margin', 8, 4)->default(30.00);
            $table->decimal('current_margin', 8, 4)->default(0);

            // Impact flags (array: 'cost_increased','cost_decreased','recipe_changed', etc.)
            $table->json('impacts')->nullable();

            // Workflow
            $table->string('status', 20)->default('pending');   // pending|approved|kept|custom_price|snoozed
            $table->uuid('triggered_by_cost_history_id')->nullable(); // what caused this review
            $table->string('reviewer_name')->nullable();
            $table->date('snooze_until')->nullable();
            $table->text('notes')->nullable();
            $table->timestampTz('resolved_at')->nullable();

            $table->timestampsTz();

            // Indexes
            $table->index('product_id');
            $table->index('status');
            $table->index('company_id');
            $table->index(['product_id', 'channel_id', 'status']);
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pricing_reviews');
    }
};
