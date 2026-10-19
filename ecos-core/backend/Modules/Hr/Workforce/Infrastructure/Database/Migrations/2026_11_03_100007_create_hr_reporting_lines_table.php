<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * HR & Workforce OS — EPIC H1. Reporting lines.
 *
 * Who reports to whom, as its own dated record rather than a `manager_id` column
 * on the employee. That buys two things the column cannot: an employee can have a
 * dotted or functional line alongside their primary one, and a reorganisation is
 * history rather than an overwrite. The organisation chart is walked from here.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('hr_reporting_lines')) {
            return;
        }

        Schema::create('hr_reporting_lines', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignUuid('employee_id')->constrained('hr_employees')->cascadeOnDelete();
            $table->foreignUuid('manager_employee_id')->constrained('hr_employees')->cascadeOnDelete();

            $table->string('type', 20)->default('primary');   // primary | dotted | functional
            $table->boolean('is_primary')->default(true);
            $table->date('effective_from');
            $table->date('effective_to')->nullable();          // null = current
            $table->string('note', 250)->nullable();
            $table->timestamps();

            $table->index(['company_id', 'employee_id', 'effective_to'], 'hr_reporting_employee_idx');
            $table->index(['company_id', 'manager_employee_id'], 'hr_reporting_manager_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_reporting_lines');
    }
};
