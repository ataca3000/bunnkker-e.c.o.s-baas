<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * MaintenancePlan — what is DUE.
 *
 * The forward-looking half that LOG-003 deliberately did not model.
 * logistics_vehicle_maintenance_records (V1) records what was DONE and remains
 * the only place completed work is written; Fleet reads it and never inserts.
 *
 * Partial-uniqueness ("one open plan per vehicle per type") is emulated with a
 * nullable active_flag inside a plain unique index — the pattern LOG-002 proved
 * on logistics_driver_vehicle_assignments. NULLs do not collide in MySQL or
 * PostgreSQL, so closed plans never contend.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fleet_maintenance_plans', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->foreignId('fleet_unit_id')->constrained('fleet_units')->cascadeOnDelete();
            $table->uuid('company_id')->nullable();

            // Mirrors LOG-003's MaintenanceType vocabulary by value, not by FK —
            // the enum lives in the Vehicles module and stays there.
            $table->string('maintenance_type', 40);
            $table->string('name', 150);
            $table->text('description')->nullable();

            // Next-due projection, recomputed by MaintenanceSchedulingService.
            $table->decimal('next_due_km', 12, 1)->nullable();
            $table->date('next_due_date')->nullable();
            $table->decimal('last_performed_km', 12, 1)->nullable();
            $table->date('last_performed_date')->nullable();

            // Grace beyond due before the plan becomes a hard blocker.
            $table->unsignedSmallInteger('grace_days')->default(0);
            $table->unsignedInteger('grace_km')->default(0);

            $table->boolean('is_active')->default(true);
            $table->unsignedTinyInteger('active_flag')->nullable()->default(1);

            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->unique(
                ['fleet_unit_id', 'maintenance_type', 'active_flag'],
                'fleet_plan_one_open_per_type_unique',
            );
            $table->index(['company_id', 'next_due_date'], 'fleet_plans_company_due_idx');
            $table->index(['fleet_unit_id', 'is_active'], 'fleet_plans_unit_active_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fleet_maintenance_plans');
    }
};
