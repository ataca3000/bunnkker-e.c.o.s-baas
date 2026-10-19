<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('inventory_items')) {
            return;
        }

        Schema::create('inventory_items', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('warehouse_id')->constrained('warehouses')->restrictOnDelete();
            $table->foreignUuid('product_id')->constrained('products')->restrictOnDelete();
            $table->foreignUuid('company_id')->constrained('companies')->restrictOnDelete();
            $table->decimal('on_hand_qty', 15, 4)->default(0);
            $table->decimal('reserved_qty', 15, 4)->default(0);
            $table->softDeletes();
            $table->timestamps();

            // One row per warehouse+product location.
            $table->unique(['warehouse_id', 'product_id']);

            $table->index('company_id');
            $table->index('product_id');
            $table->index('warehouse_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_items');
    }
};
