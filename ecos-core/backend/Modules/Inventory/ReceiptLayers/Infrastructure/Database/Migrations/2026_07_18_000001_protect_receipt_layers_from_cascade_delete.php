<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * P0-001: Change ON DELETE action on inventory_receipt_layers FK columns from
 * CASCADE to RESTRICT.
 *
 * Rationale: CASCADE silently destroys FIFO layer history when a GoodsReceipt or
 * Supplier row is deleted.  RESTRICT forces the caller to resolve outstanding
 * FIFO layers before the parent record can be removed, which is the correct
 * invariant for an immutable cost ledger.
 *
 * The columns remain nullable (applied in the 290000 migration) to support
 * adjustment-in layers that have no associated GoodsReceipt.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventory_receipt_layers', function (Blueprint $table): void {
            $table->dropForeign(['goods_receipt_id']);
            $table->dropForeign(['goods_receipt_line_id']);
            $table->dropForeign(['supplier_id']);

            $table->foreign('goods_receipt_id')
                ->references('id')->on('goods_receipts')->restrictOnDelete();
            $table->foreign('goods_receipt_line_id')
                ->references('id')->on('goods_receipt_lines')->restrictOnDelete();
            $table->foreign('supplier_id')
                ->references('id')->on('suppliers')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('inventory_receipt_layers', function (Blueprint $table): void {
            $table->dropForeign(['goods_receipt_id']);
            $table->dropForeign(['goods_receipt_line_id']);
            $table->dropForeign(['supplier_id']);

            $table->foreign('goods_receipt_id')
                ->references('id')->on('goods_receipts')->cascadeOnDelete();
            $table->foreign('goods_receipt_line_id')
                ->references('id')->on('goods_receipt_lines')->cascadeOnDelete();
            $table->foreign('supplier_id')
                ->references('id')->on('suppliers')->cascadeOnDelete();
        });
    }
};
