<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Finance OS — EPIC F1. Fiscal years.
 *
 * A fiscal year is the outer calendar boundary. Its status gates every period
 * inside it: nothing posts into a locked year. Company-scoped (org companies are
 * UUID-keyed, referenced by id without a hard cross-module FK — additive).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('finance_fiscal_years', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id');

            $table->string('name', 40);            // e.g. "FY2026"
            $table->date('start_date');
            $table->date('end_date');

            // open | closed | locked
            $table->string('status', 20)->default('open');
            $table->timestamp('closed_at')->nullable();
            $table->timestamp('locked_at')->nullable();

            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'name'], 'finance_fy_company_name_unique');
            $table->index(['company_id', 'status'], 'finance_fy_company_status_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finance_fiscal_years');
    }
};
