<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * HR & Workforce OS — EPIC H2. Which shift an employee works, and from when.
 *
 * Dated rather than a column on the employee, so moving someone from mornings to
 * nights is a new assignment and the previous one stays on the record.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('hr_employee_shift_assignments')) {
            return;
        }

        Schema::create('hr_employee_shift_assignments', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignUuid('employee_id')->constrained('hr_employees')->cascadeOnDelete();
            $table->foreignUuid('shift_id')->constrained('hr_shifts')->cascadeOnDelete();

            $table->date('effective_from');
            $table->date('effective_to')->nullable();   // null = current
            $table->timestamps();

            $table->index(['company_id', 'employee_id', 'effective_to'], 'hr_shift_assignment_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_employee_shift_assignments');
    }
};
