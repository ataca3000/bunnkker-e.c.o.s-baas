<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * HR & Workforce OS — EPIC H4. Bonus recommendations.
 *
 * ┌─ THE SYSTEM SUGGESTS · A MANAGER DECIDES ───────────────────────────────┐
 * │ A recommendation is produced from measured achievement by a stated rule,   │
 * │ and it is only ever a suggestion. The manager approves it, rejects it, or  │
 * │ modifies the amount — and only that decision creates a bonus. Both the      │
 * │ recommended and the decided amount are kept, so an override is visible     │
 * │ rather than silently replacing the original number.                        │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('hr_bonus_recommendations')) {
            return;
        }

        Schema::create('hr_bonus_recommendations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignUuid('employee_id')->constrained('hr_employees')->cascadeOnDelete();

            $table->string('period_month', 7);
            $table->decimal('achievement_percent', 9, 2)->default(0);
            $table->decimal('recommended_amount', 20, 2)->default(0);
            $table->decimal('decided_amount', 20, 2)->nullable();     // set when approved or modified
            $table->char('currency', 3)->default('EGP');

            $table->string('rule_key', 60);          // the band that fired
            $table->string('rationale', 400);
            $table->json('explanation')->nullable();

            $table->string('status', 20)->default('pending');   // pending|approved|rejected|modified
            $table->foreignUuid('decided_by_employee_id')->nullable()->constrained('hr_employees')->nullOnDelete();
            $table->timestamp('decided_at')->nullable();
            $table->string('decision_note', 400)->nullable();
            $table->uuid('bonus_id')->nullable();    // the bonus this decision created

            $table->timestamps();

            $table->unique(['company_id', 'employee_id', 'period_month'], 'hr_recommendation_unique');
            $table->index(['company_id', 'status'], 'hr_recommendation_status_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_bonus_recommendations');
    }
};
