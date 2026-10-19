<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * HR & Workforce OS — EPIC H2. Leave requests.
 *
 * ┌─ A REQUEST, A DECISION, AND A FLAG FOR PAYROLL ─────────────────────────┐
 * │ An employee asks for days off, a manager approves or rejects, and the       │
 * │ approved days are written onto the attendance record. That is the whole     │
 * │ workflow.                                                                  │
 * │                                                                            │
 * │ `payroll_flag` is the one thing Payroll needs from HR: whether these days   │
 * │ are deducted from salary or not. HR states the intent; Payroll does the     │
 * │ arithmetic. There are no leave balances, no leave types and no annual leave │
 * │ policy here — those are entitlement questions this epic does not answer.    │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('hr_leave_requests')) {
            return;
        }

        Schema::create('hr_leave_requests', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignUuid('employee_id')->constrained('hr_employees')->cascadeOnDelete();

            $table->string('request_number', 40);
            $table->date('start_date');
            $table->date('end_date');
            $table->unsignedSmallInteger('days_count');       // inclusive calendar days requested
            $table->string('reason', 400)->nullable();

            // The only payroll concern HR owns: deduct salary, or do not.
            $table->string('payroll_flag', 25)->default('deduct_salary');
            $table->string('status', 15)->default('pending'); // pending | approved | rejected | cancelled

            $table->foreignUuid('decided_by_employee_id')->nullable()->constrained('hr_employees')->nullOnDelete();
            $table->timestamp('decided_at')->nullable();
            $table->string('decision_note', 400)->nullable();

            $table->unsignedBigInteger('requested_by')->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'request_number'], 'hr_leave_number_unique');
            $table->index(['company_id', 'status'], 'hr_leave_status_idx');
            $table->index(['company_id', 'employee_id', 'start_date'], 'hr_leave_employee_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_leave_requests');
    }
};
