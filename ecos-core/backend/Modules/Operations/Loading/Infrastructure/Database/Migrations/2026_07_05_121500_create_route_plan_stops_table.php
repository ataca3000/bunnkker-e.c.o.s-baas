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
        if (Schema::hasTable('route_plan_stops')) {
            return;
        }

        Schema::create('route_plan_stops', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->foreignUuid('route_plan_id')->constrained('route_plans')->restrictOnDelete();
            $table->foreignUuid('vehicle_assignment_id')->constrained('vehicle_assignments')->restrictOnDelete();
            $table->uuid('order_id');
            $table->string('order_number_snapshot', 50);
            $table->string('customer_name_snapshot', 255)->nullable();
            $table->text('delivery_address_snapshot')->nullable();
            $table->uuid('zone_id_snapshot')->nullable();
            $table->integer('stop_sequence');
            $table->timestampTz('planned_arrival_at')->nullable();
            $table->timestampTz('actual_arrival_at')->nullable();
            $table->timestampTz('actual_departure_at')->nullable();
            $table->string('status', 50)->default('pending');
            $table->string('failure_reason', 255)->nullable();
            $table->decimal('distance_from_prev_km', 10, 4)->nullable();
            $table->text('notes')->nullable();
            $table->timestampsTz();
            $table->uuid('created_by');
            $table->uuid('updated_by');

            $table->unique(['route_plan_id', 'stop_sequence'], 'uq_route_plan_stops_plan_sequence');
        });

        DB::statement("ALTER TABLE route_plan_stops ADD CONSTRAINT chk_route_plan_stops_status CHECK (status IN ('pending','arrived','completed','failed','skipped'))");
        DB::statement('ALTER TABLE route_plan_stops ADD CONSTRAINT chk_route_plan_stops_stop_sequence CHECK (stop_sequence >= 1)');
    }

    public function down(): void
    {
        Schema::dropIfExists('route_plan_stops');
    }
};
