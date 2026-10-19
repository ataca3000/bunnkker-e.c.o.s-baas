<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('order_line_snapshots')) {
            return;
        }

        Schema::create('order_line_snapshots', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('order_financial_snapshot_id');
            $table->uuid('order_id');
            $table->uuid('order_line_id')->nullable();
            $table->uuid('product_id')->nullable();
            $table->string('product_sku')->nullable();
            $table->string('product_name')->nullable();
            $table->decimal('quantity', 12, 4);
            $table->decimal('unit_price_at_sale', 12, 4);
            $table->decimal('regular_price_at_sale', 12, 4)->nullable();
            $table->decimal('sale_price_at_sale', 12, 4)->nullable();
            $table->decimal('line_total', 12, 4);
            $table->decimal('raw_material_cost', 12, 4)->nullable();
            $table->decimal('packaging_cost', 12, 4)->nullable();
            $table->decimal('manufacturing_cost', 12, 4)->nullable();
            $table->decimal('other_cost', 12, 4)->nullable();
            $table->decimal('recipe_cost', 12, 4)->nullable();
            $table->decimal('unit_cost', 12, 4)->nullable();
            $table->decimal('line_cost', 12, 4)->nullable();
            $table->decimal('gross_profit', 12, 4)->nullable();
            $table->decimal('margin_percent', 8, 4)->nullable();
            $table->uuid('bom_id')->nullable();
            $table->integer('bom_version_number')->nullable();
            $table->json('cost_snapshot')->nullable();
            $table->timestamps();

            $table->foreign('order_financial_snapshot_id')
                ->references('id')
                ->on('order_financial_snapshots')
                ->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_line_snapshots');
    }
};
