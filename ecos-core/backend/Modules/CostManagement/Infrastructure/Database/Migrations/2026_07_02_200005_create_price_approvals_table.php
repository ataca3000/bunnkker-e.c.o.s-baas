<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TASK-ARCH-PRICE-001 Part 13 — Approval Audit.
 *
 * Every management decision on a pricing review creates one audit record.
 * Immutable once created.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('price_approvals')) {
            return;
        }

        Schema::create('price_approvals', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            $table->uuid('pricing_review_id');
            $table->foreign('pricing_review_id')->references('id')->on('pricing_reviews')->cascadeOnDelete();

            $table->uuid('product_id');
            $table->foreign('product_id')->references('id')->on('products')->cascadeOnDelete();

            // Snapshot at decision time
            $table->decimal('old_product_cost', 15, 4);
            $table->decimal('new_product_cost', 15, 4);
            $table->decimal('old_selling_price', 15, 4);
            $table->decimal('new_selling_price', 15, 4);

            // The decision
            $table->string('action', 20);   // approve_suggested | keep_current | custom_price
            $table->decimal('custom_price', 15, 4)->nullable();
            $table->text('reason')->nullable();

            // Who & where
            $table->string('manager_name')->nullable();
            $table->json('approved_channels')->nullable(); // ['pos','website','wholesale','marketplace']

            $table->timestampTz('approved_at');
            $table->timestampTz('created_at')->useCurrent();

            // Indexes
            $table->index('pricing_review_id');
            $table->index('product_id');
            $table->index('approved_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('price_approvals');
    }
};
