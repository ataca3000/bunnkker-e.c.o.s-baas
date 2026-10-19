<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Trip — the Distribution aggregate root.
 *
 * Replaces the previous distribution_trips schema, which never ran: it used
 * gen_random_uuid() and four PostgreSQL CHECK-constraint ALTERs, and declared
 * foreignId() against companies/orders whose primary keys are actually UUIDs.
 * This version is Schema-Builder-only, MySQL-portable, and consolidates all
 * five original migrations into one create.
 *
 * Single source of truth (CTO directive 4): the trip REFERENCES the approved
 * aggregates and stores no copy of them.
 *   - shipping_company_id            → logistics_shipping_companies (LOG-001)
 *   - driver_vehicle_assignment_id   → logistics_driver_vehicle_assignments (LOG-002)
 *
 * There is deliberately no driver_id, no vehicle_id and no pairing logic: the
 * assignment ledger already guarantees one active driver per vehicle and one
 * active vehicle per driver. The previous schema also denormalised driver_name
 * and driver_phone onto the trip — dropped here as duplicate master data.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('distribution_trips')) {
            return;
        }

        Schema::create('distribution_trips', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();

            // ── Organisation ────────────────────────────────────────────────
            $table->uuid('company_id');
            $table->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete();

            // Optional link to the preparation wave that produced this trip.
            $table->uuid('preparation_wave_id')->nullable();
            $table->foreign('preparation_wave_id')->references('id')->on('preparation_waves')->nullOnDelete();

            $table->foreignId('distribution_zone_id')->nullable()
                ->constrained('distribution_zones')->nullOnDelete();

            // ── Identity ────────────────────────────────────────────────────
            $table->string('trip_number', 30);
            $table->string('name', 150);
            $table->string('type', 30)->default('company_vehicle');
            $table->unsignedSmallInteger('capacity')->default(60);

            // ── Resourcing — references only, never copies ──────────────────
            $table->foreignId('shipping_company_id')->nullable()
                ->constrained('logistics_shipping_companies')->nullOnDelete();
            $table->foreignId('driver_vehicle_assignment_id')->nullable()
                ->constrained('logistics_driver_vehicle_assignments')->nullOnDelete();

            // ── Lifecycle ───────────────────────────────────────────────────
            $table->string('status', 30)->default('planning');
            $table->unsignedInteger('orders_count')->default(0);
            $table->decimal('collection_amount', 12, 2)->default(0);
            $table->text('notes')->nullable();

            $table->timestamp('finalized_at')->nullable();
            $table->foreignId('finalized_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('dispatched_at')->nullable();
            $table->foreignId('dispatched_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('driver_notified_at')->nullable();

            // ── Driver acceptance (three explicit confirmations) ────────────
            $table->boolean('driver_accepted_products')->default(false);
            $table->boolean('driver_accepted_custody')->default(false);
            $table->boolean('driver_accepted_equipment')->default(false);
            $table->timestamp('driver_acceptance_at')->nullable();
            $table->foreignId('driver_acceptance_by')->nullable()->constrained('users')->nullOnDelete();
            $table->boolean('has_discrepancy')->default(false);
            $table->text('discrepancy_notes')->nullable();

            // ── Departure ───────────────────────────────────────────────────
            $table->timestamp('departure_at')->nullable();
            $table->foreignId('departure_by')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedInteger('odometer_start')->nullable();
            $table->decimal('fuel_level', 5, 2)->nullable();

            // ── Execution ───────────────────────────────────────────────────
            $table->timestamp('trip_started_at')->nullable();
            $table->decimal('trip_start_lat', 10, 7)->nullable();
            $table->decimal('trip_start_lng', 10, 7)->nullable();
            $table->timestamp('trip_finished_at')->nullable();
            $table->decimal('trip_finish_lat', 10, 7)->nullable();
            $table->decimal('trip_finish_lng', 10, 7)->nullable();
            $table->unsignedInteger('odometer_end')->nullable();

            // ── Rolling money totals (authoritative figures live in settlement) ──
            $table->decimal('total_cash_collected', 12, 2)->default(0);
            $table->decimal('total_bank_transfers', 12, 2)->default(0);
            $table->decimal('total_already_paid', 12, 2)->default(0);

            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['company_id', 'trip_number'], 'distribution_trips_company_number_unique');
            $table->index(['company_id', 'status']);
            $table->index(['preparation_wave_id', 'distribution_zone_id', 'status'], 'distribution_trips_wave_zone_status_idx');
            $table->index('driver_vehicle_assignment_id', 'distribution_trips_assignment_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('distribution_trips');
    }
};
