<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('inventory_layer_consumptions')) {
            return;
        }

        Schema::create('inventory_layer_consumptions', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            // Order traceability — nullable so adjustments can also consume layers
            $table->uuid('order_id')->nullable()->index();
            $table->uuid('order_line_id')->nullable()->index();

            // Inventory location
            $table->uuid('inventory_item_id')->index();
            $table->uuid('inventory_receipt_layer_id')->index();
            $table->uuid('product_id')->index();
            $table->uuid('warehouse_id')->index();
            $table->uuid('company_id')->index();

            // Costing
            $table->decimal('quantity', 15, 4);
            $table->decimal('unit_cost', 15, 4);
            $table->decimal('total_cost', 15, 4);

            // Immutable ledger — no updated_at
            $table->timestamp('created_at')->useCurrent();

            // FKs
            $table->foreign('inventory_item_id')->references('id')->on('inventory_items')->cascadeOnDelete();
            $table->foreign('inventory_receipt_layer_id')->references('id')->on('inventory_receipt_layers')->cascadeOnDelete();
            $table->foreign('product_id')->references('id')->on('products')->cascadeOnDelete();
            $table->foreign('warehouse_id')->references('id')->on('warehouses')->cascadeOnDelete();
            $table->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_layer_consumptions');
    }
};
