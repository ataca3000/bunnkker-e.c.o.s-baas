<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * ADR-013 — NOT NULL enforcement for products.company_id.
 *
 * This migration is the final step of the ADR-013 migration sequence:
 *
 *   000001 — Added nullable company_id column + backfill from channel mappings.
 *   000002 — Backfilled remaining NULLs from primary company.
 *   000003 — THIS: enforce NOT NULL now that the dataset is clean.
 *
 * SAFETY GUARD: The migration aborts with a clear error if any active product
 * still has company_id = NULL. Fix those rows (via the Product form or a targeted
 * UPDATE) and re-run.
 *
 * IMPORTANT: Run migration 000002 and verify zero NULLs before running this one.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Hard guard — refuse to proceed if any active product has no company.
        $nullCount = DB::table('products')
            ->whereNull('company_id')
            ->whereNull('deleted_at')
            ->count();

        if ($nullCount > 0) {
            throw new RuntimeException(
                "ADR-013 enforcement aborted: {$nullCount} active product(s) still have ".
                'company_id = NULL. Assign them via the Product form (or run a targeted '.
                'UPDATE) then re-run this migration.',
            );
        }

        // The original FK was created with nullOnDelete() (ON DELETE SET NULL).
        // MySQL refuses to make a column NOT NULL while that action is in place.
        // Re-create the FK as RESTRICT: a company cannot be deleted while it owns products.
        Schema::table('products', function (Blueprint $table): void {
            $table->dropForeign(['company_id']);
        });

        Schema::table('products', function (Blueprint $table): void {
            $table->uuid('company_id')->nullable(false)->change();
            $table->foreign('company_id')
                ->references('id')
                ->on('companies')
                ->restrictOnDelete();
        });
    }

    public function down(): void
    {
        // Reverse: make nullable again and restore the SET NULL action.
        Schema::table('products', function (Blueprint $table): void {
            $table->dropForeign(['company_id']);
        });

        Schema::table('products', function (Blueprint $table): void {
            $table->uuid('company_id')->nullable()->change();
            $table->foreign('company_id')
                ->references('id')
                ->on('companies')
                ->nullOnDelete();
        });
    }
};
