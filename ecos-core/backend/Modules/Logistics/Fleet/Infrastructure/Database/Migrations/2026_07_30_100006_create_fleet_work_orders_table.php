<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A work order is an instance of due maintenance being executed.
 *
 * Completing one calls LOG-003's VehicleMaintenanceService to write the V1
 * record; v1_maintenance_record_id is that call's receipt. Fleet never inserts
 * into logistics_vehicle_maintenance_records — one writer per table.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fleet_work_orders', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->foreignId('fleet_unit_id')->constrained('fleet_units')->cascadeOnDelete();
            $table->foreignId('maintenance_plan_id')->nullable()
                ->constrained('fleet_maintenance_plans')->nullOnDelete();
            $table->uuid('company_id')->nullable();

            $table->string('status', 20)->default('planned');
            $table->string('maintenance_type', 40);
            // Preventive (a plan came due) vs corrective (a defect) vs statutory.
            $table->string('kind', 20)->default('preventive');
            $table->text('description')->nullable();

            $table->date('scheduled_for')->nullable();
            $table->string('vendor', 150)->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();

            $table->decimal('odometer_at_start_km', 12, 1)->nullable();
            $table->decimal('odometer_at_completion_km', 12, 1)->nullable();

            $table->decimal('cost', 14, 2)->nullable();
            $table->string('currency', 3)->nullable();

            // Receipt from the V1 service call — proves the boundary was crossed
            // correctly and makes compliance auditable in the data.
            $table->unsignedBigInteger('v1_maintenance_record_id')->nullable();

            // Does this work take the vehicle off the road while in progress?
            $table->boolean('is_immobilising')->default(false);

            $table->text('cancellation_reason')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('completed_by')->nullable();
            $table->timestamps();

            $table->index(['fleet_unit_id', 'status'], 'fleet_wo_unit_status_idx');
            $table->index(['company_id', 'status', 'scheduled_for'], 'fleet_wo_company_sched_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fleet_work_orders');
    }
};
