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
        if (Schema::hasColumn('supplier_invoices', 'company_id')) {
            return;
        }

        Schema::table('supplier_invoices', function (Blueprint $table) {
            $table->uuid('company_id')->nullable()->after('id');
            $table->foreign('company_id')->references('id')->on('companies')->restrictOnDelete();
            $table->index('company_id');
        });

        // Backfill from warehouse
        DB::statement('
            UPDATE supplier_invoices si
            INNER JOIN warehouses w ON si.warehouse_id = w.id
            SET si.company_id = w.company_id
            WHERE si.company_id IS NULL AND si.deleted_at IS NULL
        ');
    }

    public function down(): void
    {
        if (Schema::hasColumn('supplier_invoices', 'company_id')) {
            return;
        }

        Schema::table('supplier_invoices', function (Blueprint $table) {
            $table->dropForeign(['company_id']);
            $table->dropIndex(['company_id']);
            $table->dropColumn('company_id');
        });
    }
};
