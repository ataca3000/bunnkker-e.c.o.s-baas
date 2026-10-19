<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * M-01: Change all FK actions on inventory_layer_consumptions from CASCADE to RESTRICT.
 *
 * inventory_layer_consumptions is an immutable FIFO consumption ledger.
 * Every row represents a finalized cost event that has been booked into COGS.
 * Deleting any parent entity (InventoryItem, ReceiptLayer, Product, Warehouse,
 * Company) must never cascade into this table — doing so would silently destroy
 * the per-order cost audit trail and make historical P&L reports irreconcilable.
 *
 * RESTRICT forces the caller to handle consumption records before the parent
 * can be removed, which is the correct invariant for an immutable financial ledger.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventory_layer_consumptions', function (Blueprint $table): void {
            $table->dropForeign(['inventory_item_id']);
            $table->dropForeign(['inventory_receipt_layer_id']);
            $table->dropForeign(['product_id']);
            $table->dropForeign(['warehouse_id']);
            $table->dropForeign(['company_id']);

            $table->foreign('inventory_item_id')
                ->references('id')->on('inventory_items')->restrictOnDelete();

            $table->foreign('inventory_receipt_layer_id')
                ->references('id')->on('inventory_receipt_layers')->restrictOnDelete();

            $table->foreign('product_id')
                ->references('id')->on('products')->restrictOnDelete();

            $table->foreign('warehouse_id')
                ->references('id')->on('warehouses')->restrictOnDelete();

            $table->foreign('company_id')
                ->references('id')->on('companies')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('inventory_layer_consumptions', function (Blueprint $table): void {
            $table->dropForeign(['inventory_item_id']);
            $table->dropForeign(['inventory_receipt_layer_id']);
            $table->dropForeign(['product_id']);
            $table->dropForeign(['warehouse_id']);
            $table->dropForeign(['company_id']);

            $table->foreign('inventory_item_id')
                ->references('id')->on('inventory_items')->cascadeOnDelete();

            $table->foreign('inventory_receipt_layer_id')
                ->references('id')->on('inventory_receipt_layers')->cascadeOnDelete();

            $table->foreign('product_id')
                ->references('id')->on('products')->cascadeOnDelete();

            $table->foreign('warehouse_id')
                ->references('id')->on('warehouses')->cascadeOnDelete();

            $table->foreign('company_id')
                ->references('id')->on('companies')->cascadeOnDelete();
        });
    }
};
