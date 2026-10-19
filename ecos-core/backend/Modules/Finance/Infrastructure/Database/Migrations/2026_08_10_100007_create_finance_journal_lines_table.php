<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Finance OS — EPIC F1. Journal lines (the double-entry content).
 *
 * ┌─ IMMUTABLE, APPEND-ONLY, FULLY DIMENSIONED ─────────────────────────────┐
 * │ A line is the atom of financial truth. Written once by the Journal       │
 * │ Engine and never updated or deleted. Exactly one of debit / credit is    │
 * │ positive (enforced by the engine). Σ debit = Σ credit across an entry —  │
 * │ balanced by construction.                                                │
 * │                                                                          │
 * │ Every line carries its full dimension set. company / branch / cost       │
 * │ centre are live now; profit_centre / project / campaign are nullable and │
 * │ unused — the architecture is ready for them without new tables.          │
 * │                                                                          │
 * │ decimal(20,4) holds sums far beyond millions of lines.                   │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('finance_journal_lines', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->foreignId('journal_entry_id')->constrained('finance_journal_entries')->cascadeOnDelete();
            $table->foreignId('account_id')->constrained('finance_accounts')->restrictOnDelete();

            $table->decimal('debit', 20, 4)->default(0);
            $table->decimal('credit', 20, 4)->default(0);
            $table->string('description', 500)->nullable();
            $table->unsignedSmallInteger('line_number')->default(1);

            // ── Financial dimensions ──────────────────────────────────────────
            $table->uuid('company_id');
            $table->uuid('branch_id')->nullable();
            $table->foreignId('cost_center_id')->nullable()
                ->constrained('finance_cost_centers')->nullOnDelete();
            // Ready-for, not yet used:
            $table->uuid('profit_center_id')->nullable();
            $table->uuid('project_id')->nullable();
            $table->uuid('campaign_id')->nullable();

            $table->char('currency', 3)->default('EGP');

            $table->timestamps();

            // The trial-balance read path: sum debit/credit per account.
            $table->index('account_id', 'finance_jl_account_idx');
            $table->index('journal_entry_id', 'finance_jl_entry_idx');
            $table->index(['company_id', 'cost_center_id'], 'finance_jl_dimension_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finance_journal_lines');
    }
};
