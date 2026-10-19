<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Finance OS — EPIC F1. Fiscal periods.
 *
 * The posting gate. A journal may enter a period only while it is `open`;
 * `closed` is read-only, `locked` is permanent. The Posting/Journal engines
 * assert this on every entry.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('finance_fiscal_periods', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id');
            $table->foreignId('fiscal_year_id')->constrained('finance_fiscal_years')->cascadeOnDelete();

            $table->unsignedSmallInteger('period_number'); // 1..12 (or 13 for adjustment)
            $table->string('name', 40);                    // e.g. "2026-07"
            $table->date('start_date');
            $table->date('end_date');

            // future | open | closed | locked
            $table->string('status', 20)->default('future');
            $table->timestamp('opened_at')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->unsignedBigInteger('closed_by')->nullable();
            $table->timestamp('locked_at')->nullable();
            $table->unsignedBigInteger('locked_by')->nullable();

            $table->timestamps();

            $table->unique(['fiscal_year_id', 'period_number'], 'finance_fp_year_number_unique');
            $table->index(['company_id', 'status'], 'finance_fp_company_status_idx');
            // The period a given date falls into — used to resolve a posting's period.
            $table->index(['company_id', 'start_date', 'end_date'], 'finance_fp_company_dates_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finance_fiscal_periods');
    }
};
