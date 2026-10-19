<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Fuel — the largest gap in V1's cost visibility.
 *
 * LOG-003 records a vehicle's fuel_type but no consumption at all, so cost per
 * kilometre is unanswerable today. These two tables close that.
 *
 * ┌─ CASH BOUNDARY ─────────────────────────────────────────────────────────┐
 * │ Fuel spend is an EXPENSE fact posted onward to Accounting (D8). It never │
 * │ touches distribution_trip_settlements or distribution_payment_collections│
 * │ — Distribution remains the Single Cash Authority.                        │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fleet_fuel_cards', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->foreignId('fleet_id')->nullable()
                ->constrained('fleet_fleets')->nullOnDelete();
            $table->uuid('company_id')->nullable();

            $table->string('card_number', 60);
            $table->string('provider', 100)->nullable();
            $table->string('holder_name', 150)->nullable();
            $table->date('expires_on')->nullable();
            $table->boolean('is_active')->default(true);

            $table->timestamps();

            $table->unique(['company_id', 'card_number'], 'fleet_fuel_card_number_unique');
        });

        Schema::create('fleet_fuel_transactions', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->foreignId('fleet_unit_id')->constrained('fleet_units')->cascadeOnDelete();
            $table->foreignId('fuel_card_id')->nullable()
                ->constrained('fleet_fuel_cards')->nullOnDelete();
            $table->uuid('company_id')->nullable();

            $table->string('status', 20)->default('captured');
            $table->string('source', 20)->default('manual');

            $table->decimal('litres', 10, 3);
            $table->decimal('cost', 14, 2);
            $table->string('currency', 3)->default('EGP');
            $table->decimal('price_per_litre', 10, 3)->nullable();

            // Mandatory: without it, efficiency and every cost-per-km metric are
            // meaningless. FuelReconciliationService rejects a transaction with
            // no odometer rather than silently accepting bad data.
            $table->decimal('odometer_km', 12, 1);

            $table->string('station', 150)->nullable();
            $table->string('reference_number', 100)->nullable();
            $table->timestamp('transacted_at');

            $table->boolean('has_anomaly')->default(false);
            $table->json('anomaly_flags')->nullable();
            $table->decimal('efficiency_l_per_100km', 8, 3)->nullable();

            $table->json('photos')->nullable();
            $table->text('notes')->nullable();
            $table->text('resolution_reason')->nullable();

            $table->unsignedBigInteger('recorded_by')->nullable();
            $table->unsignedBigInteger('reconciled_by')->nullable();
            $table->timestamp('reconciled_at')->nullable();
            $table->timestamps();

            $table->index(['fleet_unit_id', 'transacted_at'], 'fleet_fuel_unit_time_idx');
            $table->index(['company_id', 'status'], 'fleet_fuel_company_status_idx');
            $table->index(['company_id', 'has_anomaly'], 'fleet_fuel_anomaly_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fleet_fuel_transactions');
        Schema::dropIfExists('fleet_fuel_cards');
    }
};
