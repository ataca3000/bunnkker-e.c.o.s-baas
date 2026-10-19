<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * HR & Workforce OS — EPIC H3. Salary structures.
 *
 * ┌─ COMPENSATION LIVES HERE, NOT ON THE EMPLOYEE ──────────────────────────┐
 * │ H1 deliberately kept every pay figure out of the employee record and the   │
 * │ employment contract. This is where it belongs: Payroll owns compensation.  │
 * │                                                                            │
 * │ A structure is DATED, never overwritten — a raise opens a new row and      │
 * │ closes the old one, so recalculating a past period uses the basic salary   │
 * │ that was actually in force at the time.                                    │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('hr_salary_structures')) {
            return;
        }

        Schema::create('hr_salary_structures', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignUuid('employee_id')->constrained('hr_employees')->cascadeOnDelete();

            $table->decimal('basic_salary', 20, 2)->default(0);
            $table->char('currency', 3)->default('EGP');
            $table->string('pay_frequency', 20)->default('monthly');   // monthly | weekly | daily
            $table->date('effective_from');
            $table->date('effective_to')->nullable();                  // null = in force
            $table->string('notes', 400)->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'employee_id', 'effective_to'], 'hr_salary_employee_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_salary_structures');
    }
};
