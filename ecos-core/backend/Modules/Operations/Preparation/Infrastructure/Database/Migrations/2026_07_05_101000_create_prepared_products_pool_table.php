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
        if (Schema::hasTable('prepared_products_pool')) {
            return;
        }

        Schema::create('prepared_products_pool', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->restrictOnDelete();
            $table->uuid('warehouse_id');
            $table->uuid('product_id');
            $table->string('sku_snapshot', 100);
            $table->string('name_snapshot', 255);
            $table->uuid('preparation_wave_id');
            $table->decimal('quantity_available', 18, 4)->default(0);
            $table->decimal('quantity_reserved', 18, 4)->default(0);
            $table->decimal('quantity_loaded', 18, 4)->default(0);
            $table->string('quality_status', 50)->default('pending_review');
            $table->uuid('quality_checked_by')->nullable();
            $table->timestampTz('quality_checked_at')->nullable();
            $table->timestampTz('prepared_at');
            $table->uuid('reserved_for_wave_id')->nullable();
            $table->text('notes')->nullable();
            $table->timestampsTz();
            $table->uuid('created_by');
            $table->uuid('updated_by');

            $table->unique(
                ['preparation_wave_id', 'product_id', 'warehouse_id'],
                'uq_pool_wave_product_warehouse',
            );
            $table->index('company_id', 'idx_pool_company_id');
            $table->index('product_id', 'idx_pool_product_id');
            $table->index('preparation_wave_id', 'idx_pool_preparation_wave_id');
        });

        DB::statement("ALTER TABLE prepared_products_pool ADD CONSTRAINT chk_pool_quality_status CHECK (quality_status IN ('pending_review','passed','failed'))");
        DB::statement('ALTER TABLE prepared_products_pool ADD CONSTRAINT chk_pool_qty_available_non_neg CHECK (quantity_available >= 0)');
        DB::statement('ALTER TABLE prepared_products_pool ADD CONSTRAINT chk_pool_qty_reserved_non_neg CHECK (quantity_reserved >= 0)');
        DB::statement('ALTER TABLE prepared_products_pool ADD CONSTRAINT chk_pool_qty_loaded_non_neg CHECK (quantity_loaded >= 0)');
    }

    public function down(): void
    {
        Schema::dropIfExists('prepared_products_pool');
    }
};
