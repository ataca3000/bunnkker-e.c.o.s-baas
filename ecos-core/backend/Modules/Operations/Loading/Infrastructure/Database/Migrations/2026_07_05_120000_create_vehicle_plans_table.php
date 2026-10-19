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
        if (Schema::hasTable('vehicle_plans')) {
            return;
        }

        Schema::create('vehicle_plans', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->restrictOnDelete();
            $table->date('operational_date');
            $table->string('plan_number', 50);
            $table->uuid('geography_group_id')->nullable();
            $table->uuid('shipping_company_id');
            $table->uuid('zone_id');
            $table->uuid('governorate_id');
            $table->string('status', 50);
            $table->string('distribution_policy', 50)->default('round_robin_weight');
            $table->integer('version')->default(1);
            $table->uuid('superseded_by_id')->nullable();
            $table->integer('slots_count')->default(0);
            $table->integer('orders_count')->default(0);
            $table->decimal('total_weight_kg', 18, 4)->default(0);
            $table->decimal('total_volume_m3', 18, 4)->default(0);
            $table->timestampTz('proposed_at')->nullable();
            $table->uuid('proposed_by')->nullable();
            $table->timestampTz('approved_at')->nullable();
            $table->uuid('approved_by')->nullable();
            $table->timestampTz('cancelled_at')->nullable();
            $table->uuid('cancelled_by')->nullable();
            $table->text('cancellation_reason')->nullable();
            $table->string('replan_trigger', 100)->nullable();
            $table->text('notes')->nullable();
            $table->timestampsTz();
            $table->uuid('created_by');
            $table->uuid('updated_by');

            $table->unique(['company_id', 'plan_number'], 'uq_vehicle_plans_company_plan_number');
        });

        DB::statement("ALTER TABLE vehicle_plans ADD CONSTRAINT chk_vehicle_plans_status CHECK (status IN ('calculating','proposed','approved','loading','dispatched','completed','cancelled','superseded'))");
        DB::statement("ALTER TABLE vehicle_plans ADD CONSTRAINT chk_vehicle_plans_distribution_policy CHECK (distribution_policy IN ('round_robin_weight','geographic_proximity','order_priority','fifo'))");
        DB::statement("ALTER TABLE vehicle_plans ADD CONSTRAINT chk_vehicle_plans_replan_trigger CHECK (replan_trigger IS NULL OR replan_trigger IN ('vehicle_breakdown','driver_change','extra_vehicle','late_orders','rush_orders','route_change','manual_replan','automatic_replan'))");
        DB::statement('ALTER TABLE vehicle_plans ADD CONSTRAINT chk_vehicle_plans_version CHECK (version >= 1)');
        DB::statement('ALTER TABLE vehicle_plans ADD CONSTRAINT chk_vehicle_plans_total_weight_kg CHECK (total_weight_kg >= 0)');
        DB::statement('ALTER TABLE vehicle_plans ADD CONSTRAINT chk_vehicle_plans_total_volume_m3 CHECK (total_volume_m3 >= 0)');
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicle_plans');
    }
};
