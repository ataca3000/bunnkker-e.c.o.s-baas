<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * HR & Workforce OS — EPIC H1. Employment contracts.
 *
 * ┌─ THE TERMS OF EMPLOYMENT · NOT THE PAY ─────────────────────────────────┐
 * │ A contract records what was agreed structurally — the type, the dates, the  │
 * │ probation window, the position and grade it was signed against, and the     │
 * │ contracted weekly hours. There are deliberately NO salary, allowance or     │
 * │ deduction columns: compensation is Payroll's to own and calculate, and      │
 * │ duplicating it here would create a second, drifting source of truth.        │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('hr_employment_contracts')) {
            return;
        }

        Schema::create('hr_employment_contracts', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignUuid('employee_id')->constrained('hr_employees')->cascadeOnDelete();
            $table->foreignUuid('position_id')->nullable()->constrained('hr_positions')->nullOnDelete();
            $table->foreignUuid('job_grade_id')->nullable()->constrained('hr_job_grades')->nullOnDelete();
            $table->foreignUuid('employment_type_id')->nullable()->constrained('hr_employment_types')->nullOnDelete();

            $table->string('contract_number', 40);
            $table->string('type', 20)->default('permanent');   // permanent | fixed_term | probation | contractor
            $table->string('status', 20)->default('draft');     // draft | active | expired | terminated

            $table->date('start_date');
            $table->date('end_date')->nullable();               // null for permanent
            $table->date('probation_end_date')->nullable();
            $table->decimal('weekly_hours', 5, 2)->nullable();  // contracted hours, not worked hours

            $table->timestamp('signed_at')->nullable();
            $table->timestamp('activated_at')->nullable();
            $table->timestamp('terminated_at')->nullable();
            $table->string('termination_reason', 250)->nullable();
            $table->text('notes')->nullable();

            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'contract_number'], 'hr_contract_number_unique');
            $table->index(['company_id', 'employee_id', 'status'], 'hr_contract_employee_idx');
            $table->index(['company_id', 'end_date'], 'hr_contract_expiry_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_employment_contracts');
    }
};
