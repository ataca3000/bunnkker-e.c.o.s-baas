<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * HR & Workforce OS — EPIC H4. Goals.
 *
 * ┌─ MEASURABLE OPERATIONAL TARGETS ONLY ───────────────────────────────────┐
 * │ A goal names a metric the business already measures — sales amount,        │
 * │ delivered shipments, orders packed, tickets closed — and a number to hit.  │
 * │ Because the metric key is the same one the KPI facts carry, the actual is  │
 * │ collected automatically and nobody types their own score in.               │
 * │                                                                            │
 * │ Goals belong to an employee or to a department, for one month.             │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('hr_goals')) {
            return;
        }

        Schema::create('hr_goals', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();

            $table->string('subject_type', 20);      // employee | department
            $table->uuid('subject_id');              // hr_employees.id or hr_departments.id

            $table->string('metric_key', 60);
            $table->string('title', 200);
            $table->decimal('target_value', 20, 4);
            $table->string('comparison', 10)->default('gte');   // gte (higher is better) | lte (lower is better)
            $table->unsignedSmallInteger('weight')->default(100);

            $table->string('period_month', 7);       // YYYY-MM
            $table->string('status', 20)->default('active');   // active | achieved | missed | cancelled
            $table->string('notes', 400)->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'subject_type', 'subject_id', 'metric_key', 'period_month'], 'hr_goal_unique');
            $table->index(['company_id', 'period_month', 'subject_type'], 'hr_goal_period_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_goals');
    }
};
