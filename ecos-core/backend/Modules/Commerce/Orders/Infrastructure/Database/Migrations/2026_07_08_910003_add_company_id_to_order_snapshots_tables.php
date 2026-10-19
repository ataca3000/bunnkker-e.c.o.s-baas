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
        // order_business_context_snapshots
        if (Schema::hasTable('order_business_context_snapshots') &&
            ! Schema::hasColumn('order_business_context_snapshots', 'company_id')) {
            Schema::table('order_business_context_snapshots', function (Blueprint $table): void {
                $table->foreignUuid('company_id')
                    ->nullable()
                    ->after('id')
                    ->constrained('companies')
                    ->restrictOnDelete();

                $table->index('company_id', 'idx_obcs_company');
            });

            // Backfill from orders table
            DB::statement(<<<'SQL'
                UPDATE order_business_context_snapshots s
                INNER JOIN orders o ON s.order_id = o.id
                SET s.company_id = o.company_id
                WHERE s.company_id IS NULL AND o.company_id IS NOT NULL
            SQL);
        }

        // order_financial_snapshots
        if (Schema::hasTable('order_financial_snapshots') &&
            ! Schema::hasColumn('order_financial_snapshots', 'company_id')) {
            Schema::table('order_financial_snapshots', function (Blueprint $table): void {
                $table->foreignUuid('company_id')
                    ->nullable()
                    ->after('id')
                    ->constrained('companies')
                    ->restrictOnDelete();

                $table->index('company_id', 'idx_ofs_company');
            });

            DB::statement(<<<'SQL'
                UPDATE order_financial_snapshots s
                INNER JOIN orders o ON s.order_id = o.id
                SET s.company_id = o.company_id
                WHERE s.company_id IS NULL AND o.company_id IS NOT NULL
            SQL);
        }
    }

    public function down(): void
    {
        foreach (['order_business_context_snapshots', 'order_financial_snapshots'] as $tbl) {
            if (Schema::hasTable($tbl) && Schema::hasColumn($tbl, 'company_id')) {
                Schema::table($tbl, function (Blueprint $table): void {
                    $table->dropForeign(['company_id']);
                    $table->dropColumn('company_id');
                });
            }
        }
    }
};
