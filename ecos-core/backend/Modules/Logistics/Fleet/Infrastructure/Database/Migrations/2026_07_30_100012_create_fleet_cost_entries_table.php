<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Append-only operational cost ledger.
 *
 * ┌─ D8 — FLEET OWNS OPERATIONAL COST ONLY ─────────────────────────────────┐
 * │ Accounting remains the financial authority. These rows are expense FACTS │
 * │ used to compute cost per km / per order / per zone, and are posted       │
 * │ onward to Accounting. This is not a ledger of record and never trip cash.│
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * No update path exists. A correction is a REVERSING entry pointing at the
 * original — the same discipline the domain already applies to inventory
 * movements, and what makes month-end cost reproducible.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fleet_cost_entries', function (Blueprint $table): void {
            $table->id();

            $table->foreignId('fleet_unit_id')->constrained('fleet_units')->cascadeOnDelete();
            $table->uuid('company_id')->nullable();

            $table->string('cost_type', 30);     // CostType
            $table->decimal('amount', 14, 2);
            $table->string('currency', 3)->default('EGP');
            $table->date('incurred_on');

            // Odometer at the time, so cost-per-km windows are computable
            // without re-joining the reading series.
            $table->decimal('odometer_km', 12, 1)->nullable();

            // Free-form pointer to the producing record (fuel/work order uuid).
            $table->string('source_type', 40)->nullable();
            $table->string('source_reference', 64)->nullable();

            // Reversal, not update. Null on an original entry.
            $table->unsignedBigInteger('reverses_entry_id')->nullable();
            $table->text('reversal_reason')->nullable();

            $table->text('description')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->foreign('reverses_entry_id')
                ->references('id')->on('fleet_cost_entries')->nullOnDelete();

            $table->index(['fleet_unit_id', 'cost_type', 'incurred_on'], 'fleet_cost_rollup_idx');
            $table->index(['company_id', 'incurred_on'], 'fleet_cost_company_date_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fleet_cost_entries');
    }
};
