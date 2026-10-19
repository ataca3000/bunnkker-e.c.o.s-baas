<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * HR & Workforce OS — EPIC H4. Manager reviews.
 *
 * Four fields, deliberately: a rating, what went well, what to improve, and the
 * manager's comments. This is not a talent-management evaluation form and is not
 * meant to become one — the numbers come from the KPIs, and this is the human
 * sentence next to them.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('hr_manager_reviews')) {
            return;
        }

        Schema::create('hr_manager_reviews', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignUuid('employee_id')->constrained('hr_employees')->cascadeOnDelete();
            $table->foreignUuid('reviewer_employee_id')->nullable()->constrained('hr_employees')->nullOnDelete();

            $table->string('period_month', 7);
            $table->unsignedTinyInteger('overall_rating');    // 1..5
            $table->text('strengths')->nullable();
            $table->text('improvement_notes')->nullable();
            $table->text('manager_comments')->nullable();

            $table->string('status', 20)->default('draft');   // draft | submitted
            $table->timestamp('submitted_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'employee_id', 'period_month'], 'hr_review_unique');
            $table->index(['company_id', 'period_month'], 'hr_review_period_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_manager_reviews');
    }
};
