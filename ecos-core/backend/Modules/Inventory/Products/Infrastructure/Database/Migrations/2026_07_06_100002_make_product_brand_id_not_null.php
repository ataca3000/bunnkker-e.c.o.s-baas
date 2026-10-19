<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * TASK-PRODUCT-OWNERSHIP-002 — NOT NULL enforcement for products.brand_id.
 *
 * Migration sequence:
 *   100001 — Added nullable brand_id, backfilled from channels/company, dropped company_id.
 *   100002 — THIS: enforce NOT NULL + upgrade FK action to RESTRICT.
 *
 * SAFETY GUARD: aborts if any active product has brand_id = NULL.
 * Assign those products via the Product form, then re-run.
 *
 * FK action is changed from SET NULL → RESTRICT because a brand with assigned
 * products must not be deleted; it must be deactivated or products reassigned first.
 */
return new class extends Migration
{
    public function up(): void
    {
        $nullCount = DB::table('products')
            ->whereNull('brand_id')
            ->whereNull('deleted_at')
            ->count();

        if ($nullCount > 0) {
            throw new RuntimeException(
                "Brand ownership enforcement aborted: {$nullCount} active product(s) still have ".
                'brand_id = NULL. Assign them via the Product form, then re-run this migration.',
            );
        }

        // Re-create FK as RESTRICT: brand deletion blocked while it owns products.
        if (Schema::hasColumn('products', 'brand_id')) {
            return;
        }

        Schema::table('products', function (Blueprint $table): void {
            $table->dropForeign(['brand_id']);
        });

        if (Schema::hasColumn('products', 'brand_id')) {
            return;
        }

        Schema::table('products', function (Blueprint $table): void {
            $table->uuid('brand_id')->nullable(false)->change();
            $table->foreign('brand_id')
                ->references('id')
                ->on('brands')
                ->restrictOnDelete();
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('products', 'brand_id')) {
            return;
        }

        Schema::table('products', function (Blueprint $table): void {
            $table->dropForeign(['brand_id']);
        });

        if (Schema::hasColumn('products', 'brand_id')) {
            return;
        }

        Schema::table('products', function (Blueprint $table): void {
            $table->uuid('brand_id')->nullable()->change();
            $table->foreign('brand_id')
                ->references('id')
                ->on('brands')
                ->nullOnDelete();
        });
    }
};
