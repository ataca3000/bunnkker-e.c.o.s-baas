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
        if (Schema::hasTable('vehicle_inventory_movements')) {
            return;
        }

        Schema::create('vehicle_inventory_movements', function (Blueprint $table): void {
            $table->char('id', 26)->primary();
            $table->uuid('company_id');
            $table->foreignUuid('vehicle_inventory_item_id')->constrained('vehicle_inventory_items')->restrictOnDelete();
            $table->uuid('vehicle_assignment_id');
            $table->uuid('vehicle_id');
            $table->uuid('product_id');
            $table->date('operational_date');
            $table->string('movement_type', 50);
            $table->decimal('quantity', 18, 4);
            $table->string('reference_type', 50);
            $table->uuid('reference_id');
            $table->uuid('actor_id');
            $table->string('actor_type', 20)->default('user');
            $table->text('notes')->nullable();
            $table->timestampTz('recorded_at')->useCurrent();
        });

        DB::statement("ALTER TABLE vehicle_inventory_movements ADD CONSTRAINT chk_vehicle_inventory_movements_movement_type CHECK (movement_type IN ('loaded','allocated','unallocated','delivered','returned','adjusted'))");
        DB::statement("ALTER TABLE vehicle_inventory_movements ADD CONSTRAINT chk_vehicle_inventory_movements_reference_type CHECK (reference_type IN ('loading_task','order_allocation','reconciliation','adjustment'))");
        DB::statement("ALTER TABLE vehicle_inventory_movements ADD CONSTRAINT chk_vehicle_inventory_movements_actor_type CHECK (actor_type IN ('user','system','driver'))");
        DB::statement('ALTER TABLE vehicle_inventory_movements ADD CONSTRAINT chk_vehicle_inventory_movements_quantity CHECK (quantity > 0)');
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicle_inventory_movements');
    }
};
