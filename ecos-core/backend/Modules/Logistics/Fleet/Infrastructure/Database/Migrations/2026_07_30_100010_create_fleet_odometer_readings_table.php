<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The governed odometer series.
 *
 * Readings arrive from fuel stops, inspections, maintenance, manual entry and
 * (eventually) telemetry. Multiple uncoordinated writers guarantee corruption,
 * so OdometerService is the single writer and resolves contention by source
 * trust.
 *
 * A REJECTED reading is retained rather than discarded: a rolled-back odometer
 * is evidence of a data or hardware problem, not noise. This is also why
 * distance-based cost metrics can be audited back to their inputs.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fleet_odometer_readings', function (Blueprint $table): void {
            $table->id();

            $table->foreignId('fleet_unit_id')->constrained('fleet_units')->cascadeOnDelete();
            $table->uuid('company_id')->nullable();

            $table->decimal('reading_km', 12, 1);
            $table->string('source', 20);        // OdometerSource
            $table->timestamp('recorded_at');

            $table->boolean('is_accepted')->default(true);
            $table->string('rejection_reason', 200)->nullable();

            // Free-form pointer back to whatever produced the reading
            // (work order uuid, fuel transaction uuid, inspection uuid).
            $table->string('source_reference', 64)->nullable();

            $table->unsignedBigInteger('recorded_by')->nullable();
            $table->timestamps();

            $table->index(['fleet_unit_id', 'recorded_at'], 'fleet_odo_unit_time_idx');
            $table->index(['fleet_unit_id', 'is_accepted', 'reading_km'], 'fleet_odo_latest_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fleet_odometer_readings');
    }
};
