<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * HR & Workforce OS — EPIC H1. Employees — the workforce single source of truth.
 *
 * ┌─ ONE EMPLOYEE RECORD · REFERENCED EVERYWHERE, COPIED NOWHERE ───────────┐
 * │ Shipping references a driver, Inventory a warehouse operative,             │
 * │ Manufacturing an operator, CRM and Commerce a salesperson — every one of     │
 * │ them by this row's id. No module keeps its own copy of a person's name,     │
 * │ contact details or employment status, so there is exactly one place to      │
 * │ update when any of it changes.                                             │
 * │                                                                            │
 * │ `user_id` links the person to their login when they have one. Not every     │
 * │ employee does, and not every user is an employee, so the link is optional   │
 * │ in both directions.                                                        │
 * │                                                                            │
 * │ NO COMPENSATION LIVES HERE. Salary, allowances and deductions belong to     │
 * │ Payroll; HR owns who someone is and how they are employed, never what they  │
 * │ are paid.                                                                  │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('hr_employees')) {
            return;
        }

        Schema::create('hr_employees', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignUuid('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->foreignUuid('department_id')->nullable()->constrained('hr_departments')->nullOnDelete();
            $table->foreignUuid('position_id')->nullable()->constrained('hr_positions')->nullOnDelete();
            $table->foreignUuid('job_grade_id')->nullable()->constrained('hr_job_grades')->nullOnDelete();
            $table->foreignUuid('employment_type_id')->nullable()->constrained('hr_employment_types')->nullOnDelete();

            // The login this person uses, when they have one.
            $table->unsignedBigInteger('user_id')->nullable();
            $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();

            $table->string('employee_number', 30);
            $table->string('first_name', 100);
            $table->string('last_name', 100);
            $table->string('display_name', 200)->nullable();
            $table->string('national_id', 40)->nullable();
            $table->string('gender', 12)->nullable();
            $table->date('date_of_birth')->nullable();

            $table->string('work_email', 150)->nullable();
            $table->string('personal_email', 150)->nullable();
            $table->string('phone', 30)->nullable();
            $table->string('mobile', 30)->nullable();
            $table->string('address', 250)->nullable();
            $table->string('city', 100)->nullable();
            $table->string('country', 100)->nullable();
            $table->string('emergency_contact_name', 150)->nullable();
            $table->string('emergency_contact_phone', 30)->nullable();

            $table->date('hire_date')->nullable();
            $table->date('termination_date')->nullable();
            $table->string('termination_reason', 250)->nullable();
            $table->string('status', 20)->default('active');
            $table->string('photo_path', 300)->nullable();
            $table->text('notes')->nullable();

            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['company_id', 'employee_number'], 'hr_employee_number_unique');
            $table->index(['company_id', 'status'], 'hr_employee_status_idx');
            $table->index(['company_id', 'department_id'], 'hr_employee_department_idx');
            $table->index(['company_id', 'branch_id'], 'hr_employee_branch_idx');
            $table->index('user_id', 'hr_employee_user_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_employees');
    }
};
