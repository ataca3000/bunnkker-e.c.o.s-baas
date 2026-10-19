<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * HR & Workforce OS — EPIC H1. Positions.
 *
 * A named job inside a department, at a job grade. Employees are appointed to a
 * position; the position itself is a structural definition, not a person.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('hr_positions')) {
            return;
        }

        Schema::create('hr_positions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignUuid('department_id')->nullable()->constrained('hr_departments')->nullOnDelete();
            $table->foreignUuid('job_grade_id')->nullable()->constrained('hr_job_grades')->nullOnDelete();

            $table->string('code', 30);
            $table->string('title', 150);
            $table->string('description', 300)->nullable();
            $table->unsignedSmallInteger('headcount_limit')->nullable();   // null = unlimited
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['company_id', 'code'], 'hr_position_code_unique');
            $table->index(['company_id', 'department_id'], 'hr_position_department_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_positions');
    }
};
