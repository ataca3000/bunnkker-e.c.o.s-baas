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
        // ── Step 1: Create the customer_brands relationship table ─────────────
        if (! Schema::hasTable('customer_brands')) {
            Schema::create('customer_brands', function (Blueprint $table): void {
                $table->uuid('id')->primary();
                $table->foreignUuid('customer_id')
                    ->constrained('customers')
                    ->cascadeOnDelete();
                $table->foreignUuid('brand_id')
                    ->constrained('brands')
                    ->restrictOnDelete();

                // Commercial history — maintained by dedicated domain services after order events.
                // Never updated by CRUD operations on the customer itself.
                $table->timestamp('first_order_at')->nullable();
                $table->timestamp('last_order_at')->nullable();
                $table->unsignedInteger('orders_count')->default(0);
                $table->decimal('lifetime_value', 15, 2)->default(0);

                // Primary flag — prepared for policy-driven assignment; first brand defaults to true.
                $table->boolean('is_primary')->default(false);

                // Relationship status: active | inactive | blocked
                $table->string('status', 30)->default('active');

                $table->timestamps();

                $table->unique(['customer_id', 'brand_id'], 'uq_customer_brands');
                $table->index('customer_id', 'idx_cb_customer');
                $table->index('brand_id', 'idx_cb_brand');
            });
        }

        // ── Step 2: Migrate existing brand_id from customers table ────────────
        // Only runs if the old column still exists (handles fresh installs too).
        if (Schema::hasColumn('customers', 'brand_id')) {
            // This statement was written against PostgreSQL and could never execute:
            // the platform runs MySQL 8.4 and defines no other engine. gen_random_uuid()
            // does not exist there, and ON CONFLICT is not MySQL syntax, so migrate:fresh
            // aborted here — at migration 411 of 699 — taking every RefreshDatabase test
            // with it. Translated in place; the shape, columns and semantics are unchanged.
            //
            //   gen_random_uuid()  -> UUID()                       both yield a char(36) UUID
            //   ON CONFLICT ... DO NOTHING
            //                      -> ON DUPLICATE KEY UPDATE customer_id = customer_id
            //
            // The no-op UPDATE is the exact analogue of DO NOTHING against the
            // uq_customer_brands unique key. INSERT IGNORE would also skip duplicates but
            // would swallow unrelated errors as warnings, which this backfill must not do —
            // the row-count gate below depends on real failures surfacing.
            DB::statement(<<<'SQL'
                INSERT INTO customer_brands (
                    id,
                    customer_id,
                    brand_id,
                    is_primary,
                    status,
                    created_at,
                    updated_at
                )
                SELECT
                    UUID(),
                    c.id,
                    c.brand_id,
                    true,
                    'active',
                    NOW(),
                    NOW()
                FROM customers c
                WHERE c.brand_id IS NOT NULL
                ON DUPLICATE KEY UPDATE customer_id = customer_id
            SQL);

            // ── Step 3: Safety gate — abort if row counts do not match ────────
            $withBrand = (int) DB::selectOne(
                'SELECT COUNT(*) AS cnt FROM customers WHERE brand_id IS NOT NULL'
            )?->cnt;

            $migrated = (int) DB::selectOne(
                'SELECT COUNT(*) AS cnt FROM customer_brands WHERE is_primary = true'
            )?->cnt;

            if ($migrated < $withBrand) {
                throw new RuntimeException(sprintf(
                    '[TASK-CUSTOMER-BRAND-RELATIONSHIP-001] Migration incomplete: %d rows migrated, %d expected. Aborting.',
                    $migrated,
                    $withBrand,
                ));
            }

            logger()->info('[TASK-CUSTOMER-BRAND-RELATIONSHIP-001] Brand relationships migrated to customer_brands.', [
                'migrated'         => $migrated,
                'total_with_brand' => $withBrand,
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_brands');
    }
};
