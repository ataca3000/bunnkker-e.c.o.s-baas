<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * HR & Workforce OS — EPIC H3. Payroll runs, payslips and payslip lines.
 *
 * ┌─ THE CALCULATION, ITEMISED ─────────────────────────────────────────────┐
 * │ A run calculates a period. Each employee gets a payslip carrying the        │
 * │ headline figures, and every figure is backed by LINES — one per bonus, per  │
 * │ commission rule, per advance installment, per approved deduction. A line    │
 * │ keeps the rule or document it came from, so "why is this number what it     │
 * │ is" is answered by reading the payslip rather than re-running the engine.  │
 * │                                                                            │
 * │ `explanation` holds the full deterministic breakdown, including the inputs  │
 * │ and the formula, which is what makes a recalculation reproducible.         │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('hr_payroll_runs')) {
            Schema::create('hr_payroll_runs', function (Blueprint $table): void {
                $table->uuid('id')->primary();
                $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
                $table->foreignUuid('payroll_period_id')->constrained('hr_payroll_periods')->cascadeOnDelete();

                $table->string('reference', 40);
                $table->string('status', 20)->default('draft');   // draft|calculated|approved|cancelled
                $table->unsignedInteger('employees_count')->default(0);

                $table->decimal('total_basic', 20, 2)->default(0);
                $table->decimal('total_bonus', 20, 2)->default(0);
                $table->decimal('total_commission', 20, 2)->default(0);
                $table->decimal('total_advances', 20, 2)->default(0);
                $table->decimal('total_deductions', 20, 2)->default(0);
                $table->decimal('total_gross', 20, 2)->default(0);
                $table->decimal('total_net', 20, 2)->default(0);
                $table->char('currency', 3)->default('EGP');

                $table->timestamp('calculated_at')->nullable();
                $table->timestamp('approved_at')->nullable();
                $table->unsignedBigInteger('calculated_by')->nullable();
                $table->unsignedBigInteger('approved_by')->nullable();
                $table->timestamps();

                $table->unique(['company_id', 'reference'], 'hr_payroll_run_reference_unique');
                $table->index(['company_id', 'payroll_period_id', 'status'], 'hr_payroll_run_period_idx');
            });
        }

        if (! Schema::hasTable('hr_payslips')) {
            Schema::create('hr_payslips', function (Blueprint $table): void {
                $table->uuid('id')->primary();
                $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
                $table->foreignUuid('payroll_run_id')->constrained('hr_payroll_runs')->cascadeOnDelete();
                $table->foreignUuid('payroll_period_id')->constrained('hr_payroll_periods')->cascadeOnDelete();
                $table->foreignUuid('employee_id')->constrained('hr_employees')->cascadeOnDelete();

                $table->string('payslip_number', 40);

                $table->decimal('basic_salary', 20, 2)->default(0);
                $table->decimal('bonus_total', 20, 2)->default(0);
                $table->decimal('commission_total', 20, 2)->default(0);
                $table->decimal('advance_total', 20, 2)->default(0);
                $table->decimal('deduction_total', 20, 2)->default(0);
                $table->decimal('gross_salary', 20, 2)->default(0);
                $table->decimal('net_salary', 20, 2)->default(0);
                $table->char('currency', 3)->default('EGP');

                $table->string('status', 20)->default('calculated');   // calculated|approved|cancelled
                $table->json('explanation')->nullable();
                $table->timestamp('calculated_at')->nullable();
                $table->timestamp('approved_at')->nullable();
                $table->timestamps();

                $table->unique(['payroll_run_id', 'employee_id'], 'hr_payslip_unique');
                $table->unique(['company_id', 'payslip_number'], 'hr_payslip_number_unique');
                $table->index(['company_id', 'employee_id'], 'hr_payslip_employee_idx');
            });
        }

        if (! Schema::hasTable('hr_payslip_lines')) {
            Schema::create('hr_payslip_lines', function (Blueprint $table): void {
                $table->uuid('id')->primary();
                $table->foreignUuid('payslip_id')->constrained('hr_payslips')->cascadeOnDelete();

                $table->string('category', 20);      // basic | bonus | commission | advance | deduction
                $table->string('code', 60)->nullable();
                $table->string('label', 200);
                $table->decimal('amount', 20, 2)->default(0);
                $table->tinyInteger('sign')->default(1);          // +1 adds, -1 subtracts
                $table->string('source_type', 40)->nullable();    // bonus | commission_rule | advance_installment | deduction
                $table->string('source_id', 64)->nullable();
                $table->json('explanation')->nullable();          // the inputs behind this one line
                $table->unsignedSmallInteger('sequence')->default(1);
                $table->timestamps();

                $table->index(['payslip_id', 'category'], 'hr_payslip_line_idx');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_payslip_lines');
        Schema::dropIfExists('hr_payslips');
        Schema::dropIfExists('hr_payroll_runs');
    }
};
