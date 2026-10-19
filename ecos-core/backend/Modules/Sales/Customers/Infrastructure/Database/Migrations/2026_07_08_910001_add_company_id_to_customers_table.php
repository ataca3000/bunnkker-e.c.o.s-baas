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
        if (Schema::hasColumn('customers', 'company_id')) {
            return;
        }

        Schema::table('customers', function (Blueprint $table): void {
            $table->foreignUuid('company_id')
                ->nullable()
                ->after('id')
                ->constrained('companies')
                ->restrictOnDelete();

            $table->index('company_id', 'idx_customers_company');
        });

        // Backfill from orders: pick the first company found for each customer.
        // Customers without orders remain nullable — they will be scoped on first write.
        DB::statement(<<<'SQL'
            UPDATE customers c
            SET company_id = (
                SELECT o.company_id
                FROM orders o
                WHERE o.customer_id = c.id
                  AND o.company_id IS NOT NULL
                LIMIT 1
            )
            WHERE c.company_id IS NULL
        SQL);
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table): void {
            $table->dropForeign(['company_id']);
            $table->dropIndex('idx_customers_company');
            $table->dropColumn('company_id');
        });
    }
};
