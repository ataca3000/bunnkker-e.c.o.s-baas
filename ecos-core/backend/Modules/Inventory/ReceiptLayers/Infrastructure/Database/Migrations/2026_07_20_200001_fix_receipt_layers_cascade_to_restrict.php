<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * H-01: Change inventory_receipt_layers.warehouse_id and product_id FK actions
 * from CASCADE to RESTRICT.
 *
 * The original migration (2026_06_25_230001) set all FKs to CASCADE.
 * The protect migration (2026_07_18_000001) fixed supplier_id, goods_receipt_id,
 * goods_receipt_line_id but missed warehouse_id and product_id.
 *
 * FIFO receipt layers are an immutable cost-of-goods ledger.
 * Deleting a warehouse or product must never silently destroy historical
 * cost records. RESTRICT forces the caller to zero all remaining_qty
 * before the parent entity can be removed.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventory_receipt_layers', function (Blueprint $table): void {
            $table->dropForeign(['warehouse_id']);
            $table->dropForeign(['product_id']);

            $table->foreign('warehouse_id')
                ->references('id')->on('warehouses')->restrictOnDelete();

            $table->foreign('product_id')
                ->references('id')->on('products')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('inventory_receipt_layers', function (Blueprint $table): void {
            $table->dropForeign(['warehouse_id']);
            $table->dropForeign(['product_id']);

            $table->foreign('warehouse_id')
                ->references('id')->on('warehouses')->cascadeOnDelete();

            $table->foreign('product_id')
                ->references('id')->on('products')->cascadeOnDelete();
        });
    }
};
