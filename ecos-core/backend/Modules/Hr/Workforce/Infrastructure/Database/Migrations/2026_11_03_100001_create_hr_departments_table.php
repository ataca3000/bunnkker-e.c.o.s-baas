<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * HR & Workforce OS — EPIC H1. Departments.
 *
 * ┌─ THE ORGANISATION IS REFERENCED, NOT REBUILT ───────────────────────────┐
 * │ Company and Branch already exist and are owned by the Organization module.  │
 * │ A department points at them; it never copies them. Departments nest through │
 * │ `parent_id`, which is what the organisation chart walks.                   │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * `manager_employee_id` is added by a later migration, once hr_employees exists —
 * the two tables reference each other, so the constraint cannot be declared here.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('hr_departments')) {
            return;
        }

        Schema::create('hr_departments', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignUuid('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->foreignUuid('parent_id')->nullable()->constrained('hr_departments')->nullOnDelete();

            $table->string('code', 30);
            $table->string('name', 150);
            $table->string('description', 300)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['company_id', 'code'], 'hr_department_code_unique');
            $table->index(['company_id', 'parent_id'], 'hr_department_tree_idx');
            $table->index(['company_id', 'branch_id'], 'hr_department_branch_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_departments');
    }
};
