<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('inventory_receipt_layers')) {
            return;
        }

        Schema::create('inventory_receipt_layers', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            // Origin
            $table->uuid('supplier_id')->index();
            $table->uuid('product_id')->index();
            $table->uuid('goods_receipt_id');
            $table->uuid('goods_receipt_line_id');
            $table->uuid('warehouse_id')->index();

            // Quantities
            $table->decimal('received_qty', 15, 4);
            $table->decimal('remaining_qty', 15, 4);

            // Costing
            $table->decimal('landed_unit_cost', 15, 4)->default(0);
            $table->decimal('sale_price_snapshot', 15, 2)->nullable();

            // Timing
            $table->date('receipt_date');

            $table->timestamps();

            // FKs
            $table->foreign('supplier_id')->references('id')->on('suppliers')->cascadeOnDelete();
            $table->foreign('product_id')->references('id')->on('products')->cascadeOnDelete();
            $table->foreign('goods_receipt_id')->references('id')->on('goods_receipts')->cascadeOnDelete();
            $table->foreign('goods_receipt_line_id')->references('id')->on('goods_receipt_lines')->cascadeOnDelete();
            $table->foreign('warehouse_id')->references('id')->on('warehouses')->cascadeOnDelete();

            // Query indexes
            $table->index(['supplier_id', 'product_id']);
            $table->index(['supplier_id', 'remaining_qty']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_receipt_layers');
    }
};
