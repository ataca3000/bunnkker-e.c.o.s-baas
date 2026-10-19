<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * HR & Workforce OS — EPIC H3. Deductions.
 *
 * ┌─ EVERY DEDUCTION IS A DECISION SOMEONE MADE ────────────────────────────┐
 * │ Money taken off someone's pay is never an anonymous number. Each row       │
 * │ carries the reason, the decision, who approved it, the amount, the date    │
 * │ and any notes — and ONLY approved deductions reach a payslip.              │
 * │                                                                            │
 * │ Inventory shortage and damage liabilities reference the operational        │
 * │ document by opaque id (`source_module` + `source_reference`). Inventory     │
 * │ owns the discrepancy; HR owns the decision to recover it from pay.         │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('hr_deductions')) {
            return;
        }

        Schema::create('hr_deductions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignUuid('employee_id')->constrained('hr_employees')->cascadeOnDelete();
            $table->foreignUuid('payroll_period_id')->nullable()->constrained('hr_payroll_periods')->nullOnDelete();

            // unpaid_leave | unauthorized_absence | administrative_penalty
            // | inventory_shortage | inventory_damage | manual
            $table->string('type', 40);
            $table->decimal('amount', 20, 2);
            $table->char('currency', 3)->default('EGP');
            $table->date('deduction_date');

            $table->string('reason', 400);
            $table->string('decision', 400)->nullable();
            $table->string('status', 20)->default('pending');   // pending|approved|rejected|cancelled
            $table->unsignedBigInteger('approver_id')->nullable();
            $table->timestamp('decided_at')->nullable();
            $table->text('notes')->nullable();

            // Reference-only link back to the operational document.
            $table->string('source_module', 40)->nullable();
            $table->string('source_reference', 64)->nullable();

            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'employee_id', 'status'], 'hr_deduction_employee_idx');
            $table->index(['company_id', 'payroll_period_id'], 'hr_deduction_period_idx');
            $table->index(['company_id', 'type'], 'hr_deduction_type_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_deductions');
    }
};
