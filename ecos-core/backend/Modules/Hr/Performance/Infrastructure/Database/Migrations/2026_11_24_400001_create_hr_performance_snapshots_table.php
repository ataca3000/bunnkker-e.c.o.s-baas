<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * HR & Workforce OS — EPIC H4. Performance snapshots — the monthly history.
 *
 * One row per subject, metric and month: what was targeted, what was actually
 * measured from the KPI facts, and the achievement between them. Recomputing a
 * month overwrites its snapshot rather than adding a second, so the history is a
 * clean series and the trend chart is just these rows in date order.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('hr_performance_snapshots')) {
            return;
        }

        Schema::create('hr_performance_snapshots', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignUuid('goal_id')->nullable()->constrained('hr_goals')->nullOnDelete();

            $table->string('subject_type', 20);
            $table->uuid('subject_id');
            $table->string('metric_key', 60);
            $table->string('period_month', 7);

            $table->decimal('target_value', 20, 4)->default(0);
            $table->decimal('actual_value', 20, 4)->default(0);
            $table->decimal('achievement_percent', 9, 2)->default(0);
            $table->string('status', 20)->default('on_track');   // exceeded|achieved|on_track|at_risk|missed
            $table->unsignedInteger('fact_count')->default(0);
            $table->json('explanation')->nullable();
            $table->timestamp('computed_at');
            $table->timestamps();

            $table->unique(['company_id', 'subject_type', 'subject_id', 'metric_key', 'period_month'], 'hr_snapshot_unique');
            $table->index(['company_id', 'period_month', 'status'], 'hr_snapshot_period_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_performance_snapshots');
    }
};
