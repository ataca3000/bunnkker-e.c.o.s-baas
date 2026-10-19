<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Finance OS — EPIC F4. Closing runs (period or year-end orchestration).
 *
 * A closing run is the controlled workflow that validates a period or year and,
 * once its blocking checks pass, closes it. It never touches the ledger; it
 * orchestrates the F1 fiscal transitions and records the maker/checker decision
 * and the readiness score at the moment of close.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('finance_closing_runs', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id');
            $table->string('scope', 10); // period | year
            $table->foreignId('fiscal_period_id')->nullable()->constrained('finance_fiscal_periods')->cascadeOnDelete();
            $table->foreignId('fiscal_year_id')->nullable()->constrained('finance_fiscal_years')->cascadeOnDelete();

            // draft | validated | closed | finalized
            $table->string('status', 20)->default('draft');
            $table->decimal('readiness_score', 5, 2)->nullable();
            $table->string('notes', 500)->nullable();

            $table->unsignedBigInteger('initiated_by')->nullable();
            $table->unsignedBigInteger('approved_by')->nullable();
            $table->timestamp('validated_at')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'scope', 'status'], 'finance_crun_scope_status_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finance_closing_runs');
    }
};
