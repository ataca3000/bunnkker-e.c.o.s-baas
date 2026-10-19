<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Finance OS — EPIC F4. VAT returns.
 *
 * A snapshot of a VAT period's derived figures at generation time: output VAT,
 * recoverable and non-recoverable input VAT, and the net payable/reclaimable.
 * The snapshot is the filed document; the live figures remain derivable from the
 * ledger for reconciliation.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('finance_vat_returns', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id');
            $table->foreignId('vat_period_id')->constrained('finance_vat_periods')->cascadeOnDelete();

            $table->decimal('output_vat', 20, 4)->default(0);
            $table->decimal('input_vat_recoverable', 20, 4)->default(0);
            $table->decimal('input_vat_non_recoverable', 20, 4)->default(0);
            $table->decimal('net_payable', 20, 4)->default(0);

            // draft | filed | settled
            $table->string('status', 20)->default('draft');
            $table->string('notes', 500)->nullable();
            $table->timestamp('generated_at');
            $table->timestamp('filed_at')->nullable();
            $table->unsignedBigInteger('filed_by')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'vat_period_id'], 'finance_vatr_period_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finance_vat_returns');
    }
};
