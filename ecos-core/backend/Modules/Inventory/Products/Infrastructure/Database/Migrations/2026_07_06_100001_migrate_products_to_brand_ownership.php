<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * TASK-PRODUCT-OWNERSHIP-002 — Brand Ownership Migration.
 *
 * Replaces direct Product → Company ownership with Product → Brand → Company.
 *
 *   1. Add brand_id nullable FK → brands.id
 *   2. Backfill via product_channel_mappings → channels.brand_id
 *   3. Backfill remaining via products.company_id → oldest brand for that company
 *   4. Drop company_id FK and column
 *
 * DOWN: re-adds company_id derived from brand → company, removes brand_id.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('products', 'brand_id')) {
            return;
        }

        Schema::table('products', function (Blueprint $table): void {
            $table->foreignUuid('brand_id')
                ->nullable()
                ->after('id')
                ->constrained('brands')
                ->nullOnDelete();
        });

        // Backfill path 1: channel mapping → channel.brand_id
        DB::statement('
            UPDATE products p
            SET brand_id = (
                SELECT ch.brand_id
                FROM product_channel_mappings pcm
                INNER JOIN channels ch ON ch.id = pcm.channel_id
                WHERE pcm.product_id = p.id
                  AND pcm.deleted_at IS NULL
                  AND ch.deleted_at IS NULL
                  AND ch.brand_id IS NOT NULL
                ORDER BY pcm.created_at ASC LIMIT 1
            )
            WHERE p.deleted_at IS NULL AND p.brand_id IS NULL
        ');

        // Backfill path 2: products.company_id → oldest brand in that company
        DB::statement('
            UPDATE products p
            SET brand_id = (
                SELECT b.id FROM brands b
                WHERE b.company_id = p.company_id
                  AND b.deleted_at IS NULL
                ORDER BY b.created_at ASC LIMIT 1
            )
            WHERE p.deleted_at IS NULL
              AND p.brand_id IS NULL
              AND p.company_id IS NOT NULL
        ');

        // Drop company_id (FK was made RESTRICT in migration 000003)
        if (Schema::hasColumn('products', 'brand_id')) {
            return;
        }

        Schema::table('products', function (Blueprint $table): void {
            $table->dropForeign(['company_id']);
            $table->dropColumn('company_id');
        });
    }

    public function down(): void
    {
        // Restore company_id derived from brand → company
        if (Schema::hasColumn('products', 'brand_id')) {
            return;
        }

        Schema::table('products', function (Blueprint $table): void {
            $table->foreignUuid('company_id')
                ->nullable()
                ->after('id')
                ->constrained('companies')
                ->nullOnDelete();
        });

        DB::statement('
            UPDATE products p
            SET company_id = (
                SELECT b.company_id FROM brands b
                WHERE b.id = p.brand_id
                  AND b.deleted_at IS NULL
                LIMIT 1
            )
            WHERE p.deleted_at IS NULL AND p.company_id IS NULL
        ');

        // Drop brand_id
        if (Schema::hasColumn('products', 'brand_id')) {
            return;
        }

        Schema::table('products', function (Blueprint $table): void {
            $table->dropForeign(['brand_id']);
            $table->dropColumn('brand_id');
        });
    }
};
