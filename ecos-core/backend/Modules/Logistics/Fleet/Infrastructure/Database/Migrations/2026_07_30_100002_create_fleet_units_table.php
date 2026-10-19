<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * FleetUnit — the operational shadow of exactly one V1 vehicle.
 *
 * ┌─ DIRECTIVE 2 — NO DUPLICATE MASTER DATA ────────────────────────────────┐
 * │ This table holds CONDITION, never IDENTITY. Plate, VIN, capacity, type,  │
 * │ fuel type and operational status all remain in logistics_vehicles        │
 * │ (LOG-003) and are read through the FK. If anyone adds plate_number or    │
 * │ capacity_orders here, the boundary has been broken.                      │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * FleetUnit exists rather than hanging health off the vehicle row because the
 * alternative means V2 columns on a V1 table — which Directive 1 forbids.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fleet_units', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            // 1:1 with the V1 vehicle. The unique constraint IS the invariant.
            $table->unsignedBigInteger('vehicle_id')->unique('fleet_units_vehicle_unique');
            $table->foreign('vehicle_id')->references('id')->on('logistics_vehicles')->cascadeOnDelete();

            $table->foreignId('fleet_group_id')->nullable()
                ->constrained('fleet_groups')->nullOnDelete();

            // Nullable to mirror logistics_vehicles.company_id, which LOG-003
            // also allows to be null for unscoped reference vehicles.
            $table->uuid('company_id')->nullable();
            $table->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete();

            $table->string('lifecycle_state', 30)->default('draft');
            $table->text('lifecycle_reason')->nullable();
            $table->timestamp('commissioned_at')->nullable();
            $table->timestamp('retired_at')->nullable();

            // Denormalised current odometer, written ONLY by OdometerService.
            // The governed series in fleet_odometer_readings remains the source
            // of truth; this is a read cache to keep fitness checks cheap.
            $table->decimal('current_odometer_km', 12, 1)->nullable();
            $table->timestamp('odometer_updated_at')->nullable();

            // Depreciation inputs — operational cost only (D8). Accounting
            // remains the financial authority; these drive cost-per-km, not books.
            $table->decimal('acquisition_cost', 14, 2)->nullable();
            $table->string('currency', 3)->nullable();
            $table->date('acquisition_date')->nullable();
            $table->unsignedSmallInteger('useful_life_months')->nullable();

            $table->text('notes')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'lifecycle_state'], 'fleet_units_company_state_idx');
            $table->index(['fleet_group_id', 'lifecycle_state'], 'fleet_units_group_state_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fleet_units');
    }
};
