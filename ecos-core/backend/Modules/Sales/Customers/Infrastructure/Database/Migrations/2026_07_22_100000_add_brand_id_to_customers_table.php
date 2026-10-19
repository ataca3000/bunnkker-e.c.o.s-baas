<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ── Step 1: Add brand_id column ───────────────────────────────────────
        if (! Schema::hasColumn('customers', 'brand_id')) {
            Schema::table('customers', function (Blueprint $table): void {
                $table->foreignUuid('brand_id')
                    ->nullable()
                    ->after('company_id')
                    ->constrained('brands')
                    ->restrictOnDelete();

                $table->index('brand_id', 'idx_customers_brand');
            });
        }

        // ── Step 2: Complete any remaining company_id NULLs from orders ──────
        DB::statement(<<<'SQL'
            UPDATE customers c
            SET company_id = (
                SELECT o.company_id
                FROM orders o
                WHERE o.customer_id = c.id
                  AND o.company_id IS NOT NULL
                ORDER BY o.created_at DESC
                LIMIT 1
            )
            WHERE c.company_id IS NULL
        SQL);

        // ── Step 3: Backfill brand_id from orders → channels ─────────────────
        DB::statement(<<<'SQL'
            UPDATE customers c
            SET brand_id = (
                SELECT ch.brand_id
                FROM orders o
                INNER JOIN channels ch ON ch.id = o.channel_id
                WHERE o.customer_id = c.id
                  AND ch.brand_id IS NOT NULL
                  AND ch.deleted_at IS NULL
                ORDER BY o.created_at DESC
                LIMIT 1
            )
            WHERE c.brand_id IS NULL
        SQL);

        // ── Step 4: Auto-assign brand for companies with exactly one active brand ──
        // Safe: only fires when the answer is unambiguous (exactly one brand).
        DB::statement(<<<'SQL'
            UPDATE customers c
            SET brand_id = (
                SELECT b.id
                FROM brands b
                WHERE b.company_id = c.company_id
                  AND b.deleted_at IS NULL
                  AND b.is_active = TRUE
                LIMIT 1
            )
            WHERE c.brand_id IS NULL
              AND c.company_id IS NOT NULL
              AND (
                SELECT COUNT(*)
                FROM brands b
                WHERE b.company_id = c.company_id
                  AND b.deleted_at IS NULL
                  AND b.is_active = TRUE
              ) = 1
        SQL);

        // ── Audit: log customers still without ownership after all backfill ───
        // These require manual review — do NOT delete or guess.
        $orphans = DB::select(<<<'SQL'
            SELECT id, code, name,
                   CASE WHEN company_id IS NULL THEN 'missing_company' ELSE 'has_company' END AS company_state,
                   CASE WHEN brand_id   IS NULL THEN 'missing_brand'   ELSE 'has_brand'   END AS brand_state
            FROM customers
            WHERE company_id IS NULL OR brand_id IS NULL
        SQL);

        if (! empty($orphans)) {
            logger()->warning('[TASK-CUSTOMER-CONTEXT-001] Customers without full ownership after backfill — require manual review', [
                'count'   => count($orphans),
                'records' => array_map(fn ($r) => (array) $r, $orphans),
            ]);
        }
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table): void {
            $table->dropForeign(['brand_id']);
            $table->dropIndex('idx_customers_brand');
            $table->dropColumn('brand_id');
        });
    }
};
