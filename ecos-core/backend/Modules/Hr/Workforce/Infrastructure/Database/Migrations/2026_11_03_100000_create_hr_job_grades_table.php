<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * HR & Workforce OS — EPIC H1. Job grades.
 *
 * The seniority ladder a position sits on. A grade carries a level for ordering
 * and nothing else — pay bands belong to Payroll, which HR does not own.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('hr_job_grades')) {
            return;
        }

        Schema::create('hr_job_grades', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();

            $table->string('code', 30);
            $table->string('name', 120);
            $table->unsignedSmallInteger('level')->default(1);   // 1 = most junior
            $table->string('description', 300)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['company_id', 'code'], 'hr_grade_code_unique');
            $table->index(['company_id', 'level'], 'hr_grade_level_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_job_grades');
    }
};
