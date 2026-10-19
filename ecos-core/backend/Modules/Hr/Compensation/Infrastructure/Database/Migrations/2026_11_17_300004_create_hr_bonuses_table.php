<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * HR & Workforce OS — EPIC H3. Bonuses.
 *
 * A bonus is money added to a period for a stated reason. It may be entered by
 * hand or arrive from an approved performance recommendation (H4) — `source`
 * records which, so a payslip line can always be traced back to the decision
 * that produced it.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('hr_bonuses')) {
            return;
        }

        Schema::create('hr_bonuses', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignUuid('employee_id')->constrained('hr_employees')->cascadeOnDelete();
            $table->foreignUuid('payroll_period_id')->nullable()->constrained('hr_payroll_periods')->nullOnDelete();

            $table->string('type', 30)->default('discretionary');   // performance|discretionary|spot|commission_adjustment
            $table->decimal('amount', 20, 2);
            $table->char('currency', 3)->default('EGP');
            $table->string('reason', 400);
            $table->date('awarded_on');

            $table->string('status', 20)->default('pending');       // pending|approved|rejected|cancelled
            $table->string('source', 30)->default('manual');        // manual | performance_recommendation
            $table->uuid('recommendation_id')->nullable();          // H4 recommendation, when that is the source

            $table->unsignedBigInteger('approved_by')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->string('notes', 400)->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'employee_id', 'status'], 'hr_bonus_employee_idx');
            $table->index(['company_id', 'payroll_period_id'], 'hr_bonus_period_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_bonuses');
    }
};
