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
        if (Schema::hasTable('vehicle_inventory_items')) {
            return;
        }

        Schema::create('vehicle_inventory_items', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->foreignUuid('vehicle_assignment_id')->constrained('vehicle_assignments')->restrictOnDelete();
            $table->uuid('vehicle_id');
            $table->uuid('product_id');
            $table->string('sku_snapshot', 100);
            $table->string('name_snapshot', 255);
            $table->date('operational_date');
            $table->uuid('pool_entry_id');
            $table->foreignUuid('loading_task_id')->constrained('loading_tasks')->restrictOnDelete();
            $table->decimal('quantity_loaded', 18, 4)->default(0);
            $table->decimal('quantity_allocated', 18, 4)->default(0);
            $table->decimal('quantity_delivered', 18, 4)->default(0);
            $table->decimal('quantity_returned', 18, 4)->default(0);
            $table->decimal('quantity_on_hand', 18, 4)->default(0);
            $table->decimal('quantity_unallocated', 18, 4)->default(0);
            $table->boolean('requires_refrigeration')->default(false);
            $table->string('status', 50)->default('active');
            $table->timestampTz('last_movement_at')->useCurrent();
            $table->timestampsTz();
            $table->uuid('created_by');
            $table->uuid('updated_by');

            $table->unique(['vehicle_assignment_id', 'product_id'], 'uq_vehicle_inventory_items_assignment_product');
        });

        DB::statement("ALTER TABLE vehicle_inventory_items ADD CONSTRAINT chk_vehicle_inventory_items_status CHECK (status IN ('active','depleted','returned','variance'))");
        DB::statement('ALTER TABLE vehicle_inventory_items ADD CONSTRAINT chk_vehicle_inventory_items_quantity_loaded CHECK (quantity_loaded >= 0)');
        DB::statement('ALTER TABLE vehicle_inventory_items ADD CONSTRAINT chk_vehicle_inventory_items_quantity_delivered CHECK (quantity_delivered >= 0)');
        DB::statement('ALTER TABLE vehicle_inventory_items ADD CONSTRAINT chk_vehicle_inventory_items_quantity_returned CHECK (quantity_returned >= 0)');
        DB::statement('ALTER TABLE vehicle_inventory_items ADD CONSTRAINT chk_vehicle_inventory_items_quantity_on_hand CHECK (quantity_on_hand >= 0)');
        DB::statement('ALTER TABLE vehicle_inventory_items ADD CONSTRAINT chk_vehicle_inventory_items_quantity_allocated CHECK (quantity_allocated >= 0)');
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicle_inventory_items');
    }
};
