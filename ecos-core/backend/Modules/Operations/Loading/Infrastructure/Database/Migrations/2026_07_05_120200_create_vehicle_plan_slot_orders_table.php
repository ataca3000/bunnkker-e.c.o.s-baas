<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('vehicle_plan_slot_orders')) {
            return;
        }

        Schema::create('vehicle_plan_slot_orders', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->foreignUuid('vehicle_plan_slot_id')->constrained('vehicle_plan_slots')->restrictOnDelete();
            $table->foreignUuid('vehicle_plan_id')->constrained('vehicle_plans')->restrictOnDelete();
            $table->uuid('order_id');
            $table->string('order_number_snapshot', 50);
            $table->string('order_type_snapshot', 50)->nullable();
            $table->uuid('channel_id_snapshot')->nullable();
            $table->uuid('zone_id_snapshot')->nullable();
            $table->decimal('estimated_weight_kg', 18, 4)->default(0);
            $table->decimal('estimated_volume_m3', 18, 4)->default(0);
            $table->integer('stop_sequence')->nullable();
            $table->timestampTz('added_at')->useCurrent();
            $table->uuid('added_by');
            $table->uuid('moved_from_slot_id')->nullable();

            $table->unique(['vehicle_plan_slot_id', 'order_id'], 'uq_vehicle_plan_slot_orders_slot_order');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicle_plan_slot_orders');
    }
};
