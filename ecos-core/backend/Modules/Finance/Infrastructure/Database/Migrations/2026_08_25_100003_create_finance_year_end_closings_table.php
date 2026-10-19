<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Finance OS — EPIC F4. Year-end closing.
 *
 * ┌─ REPEATABLE UNTIL FINALIZED · IMMUTABLE AFTER ──────────────────────────┐
 * │ Closing the year posts a P&L-closing journal (revenues and expenses swept │
 * │ to retained earnings) and an opening journal in the next year. It never    │
 * │ edits a historical journal — a re-run REVERSES the prior run's journals    │
 * │ and posts fresh ones, so it is safely repeatable. Finalizing freezes it:   │
 * │ no further runs, and the closed year is locked.                            │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('finance_year_end_closings', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id');
            $table->foreignId('fiscal_year_id')->constrained('finance_fiscal_years')->cascadeOnDelete();
            $table->foreignId('next_fiscal_year_id')->nullable()->constrained('finance_fiscal_years')->nullOnDelete();

            // draft | closed | finalized
            $table->string('status', 20)->default('draft');
            $table->foreignId('retained_earnings_account_id')->nullable()->constrained('finance_accounts')->nullOnDelete();
            $table->decimal('net_income', 20, 4)->default(0);

            $table->foreignId('pnl_closing_journal_id')->nullable()->constrained('finance_journal_entries')->nullOnDelete();
            $table->foreignId('opening_journal_id')->nullable()->constrained('finance_journal_entries')->nullOnDelete();

            $table->unsignedInteger('run_count')->default(0);
            $table->unsignedBigInteger('closed_by')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->unsignedBigInteger('finalized_by')->nullable();
            $table->timestamp('finalized_at')->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'fiscal_year_id'], 'finance_yec_company_year_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finance_year_end_closings');
    }
};
