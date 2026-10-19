<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

/**
 * TASK-CATEGORY-001 — Rename the `type` discriminator column to `category_scope`
 * and collapse `raw_material` + `packaging_material` → `material`.
 *
 * Future scopes (supplier, customer, expense, asset, …) can be added by
 * inserting new rows via this same column; no schema change required.
 *
 * PART 10 conflict detection: categories referenced by both product types and
 * material types are logged as warnings for manual review.
 */
return new class extends Migration
{
    public function up(): void
    {
        // ── Conflict detection (PART 10) ─────────────────────────────────────
        // A category is "conflicted" if it is currently used by both finished_good
        // products (expected scope=product) and raw_material/packaging_material
        // products (expected scope=material).
        $conflicts = DB::table('categories as c')
            ->join('products as p1', function ($join): void {
                $join->on('c.id', '=', 'p1.category_id')
                    ->where('p1.product_type', '=', 'finished_good')
                    ->whereNull('p1.deleted_at');
            })
            ->join('products as p2', function ($join): void {
                $join->on('c.id', '=', 'p2.category_id')
                    ->whereIn('p2.product_type', ['raw_material', 'packaging_material'])
                    ->whereNull('p2.deleted_at');
            })
            ->whereNull('c.deleted_at')
            ->select('c.id', 'c.code', 'c.name')
            ->distinct()
            ->get();

        if ($conflicts->isNotEmpty()) {
            Log::warning('[TASK-CATEGORY-001] Category scope migration: conflicted categories detected.', [
                'count' => $conflicts->count(),
                'categories' => $conflicts->map(fn ($r) => "{$r->code} — {$r->name}")->all(),
                'action' => 'These categories are assigned to both products and materials. '
                    .'They have been assigned scope=product (from their existing `type` value). '
                    .'Please review and re-assign category_scope manually if needed.',
            ]);
        }

        // ── Rename column ─────────────────────────────────────────────────────
        Schema::table('categories', function ($table): void {
            $table->renameColumn('type', 'category_scope');
        });

        // ── Collapse raw_material + packaging_material → material ─────────────
        DB::table('categories')
            ->whereIn('category_scope', ['raw_material', 'packaging_material'])
            ->update(['category_scope' => 'material']);

        // Ensure all NULLs get the default scope
        DB::table('categories')
            ->whereNull('category_scope')
            ->update(['category_scope' => 'product']);
    }

    public function down(): void
    {
        // Reverting scope=material back to raw_material is lossy (packaging is lost),
        // but acceptable for rollback purposes.
        DB::table('categories')
            ->where('category_scope', 'material')
            ->update(['category_scope' => 'raw_material']);

        Schema::table('categories', function ($table): void {
            $table->renameColumn('category_scope', 'type');
        });
    }
};
