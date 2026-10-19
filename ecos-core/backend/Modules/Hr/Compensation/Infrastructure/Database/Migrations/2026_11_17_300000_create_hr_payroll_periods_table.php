<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * HR & Workforce OS — EPIC H3. Payroll periods.
 *
 * ┌─ THE WINDOW COMPENSATION IS CALCULATED OVER ────────────────────────────┐
 * │ A period is opened, calculated, approved and closed. Approval is the point │
 * │ at which the numbers become final and Finance is told about them — HR      │
 * │ never posts the journal or pays the salary itself.                        │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('hr_payroll_periods')) {
            return;
        }

        Schema::create('hr_payroll_periods', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();

            $table->string('code', 30);              // 2026-04
            $table->string('name', 120);
            $table->date('start_date');
            $table->date('end_date');
            $table->date('payment_date')->nullable();
            $table->string('status', 20)->default('draft');   // draft|open|calculated|approved|closed
            $table->char('currency', 3)->default('EGP');

            $table->timestamp('calculated_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->unsignedBigInteger('approved_by')->nullable();
            $table->string('notes', 400)->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'code'], 'hr_payroll_period_code_unique');
            $table->index(['company_id', 'status'], 'hr_payroll_period_status_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_payroll_periods');
    }
};
