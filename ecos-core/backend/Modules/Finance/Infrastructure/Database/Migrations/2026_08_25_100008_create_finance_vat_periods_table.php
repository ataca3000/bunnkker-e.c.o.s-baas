<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Finance OS — EPIC F4. VAT periods.
 *
 * A VAT reporting window (usually monthly). Its return figures are DERIVED from
 * the ledger's output/input VAT accounts over the window — never stored on the
 * period. Settling the period posts a settlement journal through the Posting
 * Engine (output VAT and recoverable input VAT swept to VAT payable); the VAT
 * engine is independent of any e-invoicing/ETA integration.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('finance_vat_periods', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id');
            $table->string('name', 60);
            $table->date('start_date');
            $table->date('end_date');

            // open | return_generated | settled
            $table->string('status', 20)->default('open');
            $table->foreignId('settlement_journal_id')->nullable()->constrained('finance_journal_entries')->nullOnDelete();

            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('settled_by')->nullable();
            $table->timestamp('settled_at')->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'name'], 'finance_vatp_company_name_unique');
            $table->index(['company_id', 'status'], 'finance_vatp_status_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finance_vat_periods');
    }
};
