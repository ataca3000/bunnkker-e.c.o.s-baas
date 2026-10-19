<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * ADR-013 Principle 1 — Product Ownership.
 *
 * Adds a direct company_id FK to products so ownership is first-class and never
 * inferred from channel mappings at query time.
 *
 * Migration strategy (from ADR-013):
 *   1. Add nullable company_id column.
 *   2. Backfill from the first active channel mapping.
 *   3. Column remains nullable to accommodate raw materials and products that
 *      existed before any channel assignment (they should be updated via the
 *      Product form after migration).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table): void {
            $table->foreignUuid('company_id')
                ->nullable()
                ->after('id')
                ->constrained('companies')
                ->nullOnDelete();
        });

        // Backfill: set company_id from the first non-deleted channel mapping.
        // Products with no channel assignments (e.g. raw materials) remain null
        // and must be assigned via the Product form.
        DB::statement('
            UPDATE products p
            SET company_id = (
                SELECT ch.company_id
                FROM product_channel_mappings pcm
                INNER JOIN channels ch ON ch.id = pcm.channel_id
                WHERE pcm.product_id = p.id
                  AND pcm.deleted_at IS NULL
                  AND ch.deleted_at IS NULL
                ORDER BY pcm.created_at ASC
                LIMIT 1
            )
            WHERE p.deleted_at IS NULL
              AND p.company_id IS NULL
        ');
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table): void {
            $table->dropForeign(['company_id']);
            $table->dropColumn('company_id');
        });
    }
};
