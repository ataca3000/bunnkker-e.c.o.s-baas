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
        Schema::table('inventory_receipt_layers', function (Blueprint $table): void {
            $table->uuid('company_id')->nullable()->after('warehouse_id')->index();
        });

        // Backfill from the owning warehouse — works for MySQL and PostgreSQL
        DB::statement('
            UPDATE inventory_receipt_layers
            SET company_id = (
                SELECT company_id FROM warehouses
                WHERE warehouses.id = inventory_receipt_layers.warehouse_id
            )
            WHERE company_id IS NULL
        ');

        Schema::table('inventory_receipt_layers', function (Blueprint $table): void {
            $table->foreign('company_id')->references('id')->on('companies')->restrictOnDelete();
            // Hot-path index for InventoryLayerConsumptionService::consume()
            $table->index(['product_id', 'warehouse_id', 'company_id', 'remaining_qty'], 'irl_fifo_consume_idx');
        });
    }

    public function down(): void
    {
        Schema::table('inventory_receipt_layers', function (Blueprint $table): void {
            $table->dropIndex('irl_fifo_consume_idx');
            $table->dropForeign(['company_id']);
            $table->dropIndex(['company_id']);
            $table->dropColumn('company_id');
        });
    }
};
