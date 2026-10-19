<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Finance OS — EPIC F1. Journal entries (header).
 *
 * ┌─ THE SINGLE SOURCE OF FINANCIAL TRUTH ──────────────────────────────────┐
 * │ Written ONLY by the Journal Engine. Append-only: a posted entry is never │
 * │ edited or deleted — a correction is a REVERSING entry linked by          │
 * │ reverses_journal_id. The header carries no amounts; the financial        │
 * │ content lives on immutable lines, so "mutating" an entry can only mean   │
 * │ the controlled lifecycle transitions draft→posted and posted→reversed.   │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('finance_journal_entries', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id');
            $table->foreignId('fiscal_period_id')->constrained('finance_fiscal_periods')->restrictOnDelete();

            $table->date('entry_date');
            $table->string('reference', 80)->nullable();
            $table->string('description', 500)->nullable();

            // manual | posting  — where the entry originated.
            $table->string('source', 20)->default('manual');
            // For posting-sourced entries (F3): the event that produced it.
            $table->string('source_module', 40)->nullable();
            $table->string('source_event_id', 64)->nullable();

            // draft | posted | reversed
            $table->string('status', 20)->default('draft');

            // Reversal linkage — the only sanctioned correction path.
            $table->foreignId('reverses_journal_id')->nullable()
                ->constrained('finance_journal_entries')->nullOnDelete();
            $table->foreignId('reversed_by_journal_id')->nullable()
                ->constrained('finance_journal_entries')->nullOnDelete();
            $table->string('reversal_reason', 500)->nullable();

            // Maker / checker trail.
            $table->unsignedBigInteger('created_by')->nullable();     // maker
            $table->unsignedBigInteger('approved_by')->nullable();    // checker
            $table->timestamp('posted_at')->nullable();
            $table->unsignedBigInteger('posted_by')->nullable();      // poster

            $table->timestamps();

            $table->index(['company_id', 'fiscal_period_id', 'status'], 'finance_je_period_status_idx');
            $table->index(['company_id', 'entry_date'], 'finance_je_company_date_idx');
            $table->index(['source_module', 'source_event_id'], 'finance_je_source_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finance_journal_entries');
    }
};
