<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * ADR-013 — Backfill Phase 2.
 *
 * The first migration (000001) backfilled products that had at least one
 * active channel mapping. This migration handles the remainder: products whose
 * company_id is still NULL because they have no channel mappings (e.g. raw
 * materials, packaging materials, or finished goods created before channels
 * were assigned).
 *
 * Resolution strategy (in priority order):
 *   1. Channel mapping (already done in 000001 — re-run is safe, updates 0 rows).
 *   2. Primary company: the company that owns the most active channels.
 *      In a single-company setup this is unambiguous. In a multi-company setup
 *      this is a best-effort assignment; operators should review and reassign
 *      via the Product form where the correct owner differs.
 *
 * The column is kept nullable here. Migration 000003 will enforce NOT NULL
 * once the dataset is verified clean.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Step 1: re-run channel-mapping backfill (safe no-op for already-assigned rows).
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

        // Step 2: assign remaining nulls to the primary company
        // (the company that owns the greatest number of active channels).
        // If no companies exist the subquery returns NULL and no rows are touched.
        DB::statement('
            UPDATE products p
            SET company_id = (
                SELECT ch.company_id
                FROM channels ch
                WHERE ch.deleted_at IS NULL
                  AND ch.company_id IS NOT NULL
                GROUP BY ch.company_id
                ORDER BY COUNT(*) DESC
                LIMIT 1
            )
            WHERE p.deleted_at IS NULL
              AND p.company_id IS NULL
        ');

        // Report any products that could not be resolved (no companies in system).
        $unresolved = DB::table('products')
            ->whereNull('company_id')
            ->whereNull('deleted_at')
            ->count();

        if ($unresolved > 0) {
            // Non-fatal: log a clear warning so operators know manual action is needed.
            Illuminate\Support\Facades\Log::warning(
                "ADR-013 backfill: {$unresolved} product(s) still have company_id = NULL. ".
                'Assign them via the Product form before running migration 000003.',
            );
        }
    }

    public function down(): void
    {
        // Backfill is intentionally irreversible — rolling back would lose ownership data.
        // If you need to revert, use the Product form or a manual UPDATE.
    }
};
