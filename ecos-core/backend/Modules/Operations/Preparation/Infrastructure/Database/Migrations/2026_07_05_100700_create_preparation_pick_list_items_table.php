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
        if (Schema::hasTable('preparation_pick_list_items')) {
            return;
        }

        Schema::create('preparation_pick_list_items', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->foreignUuid('pick_list_id')
                ->constrained('preparation_pick_lists')
                ->restrictOnDelete();
            $table->uuid('product_id');
            $table->string('sku_snapshot', 100);
            $table->string('name_snapshot', 255);
            $table->string('warehouse_zone', 100)->nullable();
            $table->string('shelf_location', 100)->nullable();
            $table->decimal('quantity_to_pick', 18, 4);
            $table->decimal('quantity_picked', 18, 4)->default(0);
            $table->string('status', 50)->default('pending');
            $table->uuid('picked_by')->nullable();
            $table->timestampTz('picked_at')->nullable();
            $table->timestampsTz();
            $table->uuid('created_by');
            $table->uuid('updated_by');

            $table->unique(['pick_list_id', 'product_id'], 'uq_pick_list_items_list_product');
            $table->index('pick_list_id', 'idx_pick_list_items_pick_list_id');
            $table->index('product_id', 'idx_pick_list_items_product_id');
        });

        DB::statement("ALTER TABLE preparation_pick_list_items ADD CONSTRAINT chk_pick_list_items_status CHECK (status IN ('pending','in_progress','picked','short'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('preparation_pick_list_items');
    }
};
