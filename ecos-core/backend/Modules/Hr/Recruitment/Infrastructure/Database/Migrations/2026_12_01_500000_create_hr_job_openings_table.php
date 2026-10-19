<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * HR & Workforce OS — EPIC H5. Job openings.
 *
 * ┌─ THE ONE ROW THE PUBLIC INTERNET CAN SEE ───────────────────────────────┐
 * │ A job opening is the only HR record with a public face, so the columns are │
 * │ split deliberately: `is_public` and `status` decide whether it is visible   │
 * │ at all, and `show_salary` decides whether the range is shown even when it   │
 * │ is stored. Everything a visitor sees is whitelisted at the controller —     │
 * │ nothing is exposed merely because it lives on this table.                  │
 * │                                                                            │
 * │ Opening and closing a job is a status change, never a deployment.          │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('hr_job_openings')) {
            return;
        }

        Schema::create('hr_job_openings', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignUuid('department_id')->nullable()->constrained('hr_departments')->nullOnDelete();
            $table->foreignUuid('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->foreignUuid('position_id')->nullable()->constrained('hr_positions')->nullOnDelete();
            $table->foreignUuid('employment_type_id')->nullable()->constrained('hr_employment_types')->nullOnDelete();
            $table->foreignUuid('job_grade_id')->nullable()->constrained('hr_job_grades')->nullOnDelete();

            $table->string('reference', 40);
            $table->string('slug', 160);                 // the public URL segment
            $table->string('title', 200);
            $table->text('description')->nullable();
            $table->text('requirements')->nullable();
            $table->text('responsibilities')->nullable();
            $table->string('work_location', 200)->nullable();
            $table->string('work_mode', 20)->default('onsite');   // onsite | hybrid | remote

            // Stored always; published only when show_salary is set.
            $table->decimal('salary_min', 20, 2)->nullable();
            $table->decimal('salary_max', 20, 2)->nullable();
            $table->char('currency', 3)->default('EGP');
            $table->boolean('show_salary')->default(false);

            $table->unsignedSmallInteger('openings_count')->default(1);
            $table->unsignedSmallInteger('filled_count')->default(0);

            $table->string('status', 20)->default('draft');   // draft|published|on_hold|closed|filled
            $table->boolean('is_public')->default(true);
            $table->timestamp('published_at')->nullable();
            $table->date('closes_on')->nullable();
            $table->timestamp('closed_at')->nullable();

            $table->foreignUuid('hiring_manager_employee_id')->nullable()->constrained('hr_employees')->nullOnDelete();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['company_id', 'reference'], 'hr_job_reference_unique');
            $table->unique('slug', 'hr_job_slug_unique');
            $table->index(['company_id', 'status', 'is_public'], 'hr_job_public_idx');
            $table->index(['company_id', 'department_id'], 'hr_job_department_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_job_openings');
    }
};
