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
        if (Schema::hasTable('vehicle_plan_slots')) {
            return;
        }

        Schema::create('vehicle_plan_slots', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->foreignUuid('vehicle_plan_id')->constrained('vehicle_plans')->restrictOnDelete();
            $table->integer('slot_number');
            $table->uuid('vehicle_id')->nullable();
            $table->string('vehicle_registration_snapshot', 50)->nullable();
            $table->string('vehicle_type_snapshot', 50)->nullable();
            $table->decimal('capacity_weight_kg', 18, 4)->nullable();
            $table->decimal('capacity_volume_m3', 18, 4)->nullable();
            $table->integer('order_count')->default(0);
            $table->decimal('total_weight_kg', 18, 4)->default(0);
            $table->decimal('total_volume_m3', 18, 4)->default(0);
            $table->decimal('utilization_pct', 5, 2)->default(0);
            $table->boolean('is_overloaded')->default(false);
            $table->boolean('requires_refrigeration')->default(false);
            $table->timestampTz('vehicle_assigned_at')->nullable();
            $table->uuid('vehicle_assigned_by')->nullable();
            $table->string('status', 50)->default('unassigned');
            $table->text('notes')->nullable();
            $table->timestampsTz();
            $table->uuid('created_by');
            $table->uuid('updated_by');

            $table->unique(['vehicle_plan_id', 'slot_number'], 'uq_vehicle_plan_slots_plan_slot');
        });

        DB::statement("ALTER TABLE vehicle_plan_slots ADD CONSTRAINT chk_vehicle_plan_slots_status CHECK (status IN ('unassigned','assigned','confirmed','loading','dispatched','completed'))");
        DB::statement('ALTER TABLE vehicle_plan_slots ADD CONSTRAINT chk_vehicle_plan_slots_slot_number CHECK (slot_number >= 1)');
        DB::statement('ALTER TABLE vehicle_plan_slots ADD CONSTRAINT chk_vehicle_plan_slots_utilization_pct CHECK (utilization_pct >= 0 AND utilization_pct <= 200)');
        DB::statement('ALTER TABLE vehicle_plan_slots ADD CONSTRAINT chk_vehicle_plan_slots_total_weight_kg CHECK (total_weight_kg >= 0)');
        DB::statement('ALTER TABLE vehicle_plan_slots ADD CONSTRAINT chk_vehicle_plan_slots_total_volume_m3 CHECK (total_volume_m3 >= 0)');
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicle_plan_slots');
    }
};
