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
        if (Schema::hasColumn('goods_receipts', 'company_id')) {
            return;
        }

        Schema::table('goods_receipts', function (Blueprint $table): void {
            $table->foreignUuid('company_id')
                ->nullable()
                ->after('id')
                ->constrained('companies')
                ->restrictOnDelete();

            $table->index('company_id', 'idx_goods_receipts_company');
        });

        // Backfill from purchase_orders → companies
        DB::statement(<<<'SQL'
            UPDATE goods_receipts gr
            INNER JOIN purchase_orders po ON gr.purchase_order_id = po.id
            SET gr.company_id = po.company_id
            WHERE gr.company_id IS NULL
              AND po.company_id IS NOT NULL
        SQL);
    }

    public function down(): void
    {
        if (Schema::hasColumn('goods_receipts', 'company_id')) {
            return;
        }

        Schema::table('goods_receipts', function (Blueprint $table): void {
            $table->dropForeign(['company_id']);
            $table->dropIndex('idx_goods_receipts_company');
            $table->dropColumn('company_id');
        });
    }
};
