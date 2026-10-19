<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * HR V1 enhancements — post-approval adjustments.
 *
 * ┌─ APPROVED PAY IS NOT EDITABLE · IT IS ADJUSTABLE ───────────────────────┐
 * │ Once a payroll run is approved, the company has told Finance what it owes   │
 * │ its people and Finance has posted it. Quietly editing a bonus behind that   │
 * │ approval leaves the payslip, the announcement and the ledger disagreeing,   │
 * │ and nothing in the data says which one is wrong.                           │
 * │                                                                            │
 * │ So after approval the answer to "this figure was wrong" is never an edit.   │
 * │ It is an adjustment: a NEW record, in a named period, with the reason, the  │
 * │ approver and the original it corrects. The mistake stays visible, which is  │
 * │ the point — an audit that cannot see the error cannot see the correction.   │
 * │                                                                            │
 * │ An adjustment is a compensation instruction, not an accounting entry. It    │
 * │ carries no account code and posts nothing; Finance learns of it the same    │
 * │ way it learns of everything else here — when a run is approved.             │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('hr_compensation_adjustments')) {
            return;
        }

        Schema::create('hr_compensation_adjustments', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignUuid('employee_id')->constrained('hr_employees')->cascadeOnDelete();

            $table->string('reference', 40);

            // Which locked period the error was in …
            $table->foreignUuid('original_period_id')->nullable()
                ->constrained('hr_payroll_periods')->nullOnDelete();
            // … and which open period carries the correction.
            $table->foreignUuid('payroll_period_id')->nullable()
                ->constrained('hr_payroll_periods')->nullOnDelete();

            // What is being corrected: bonus|commission|deduction|advance
            $table->string('component', 20);
            // Loose reference to the frozen original — it must not cascade.
            $table->string('original_type', 40)->nullable();
            $table->string('original_id', 64)->nullable();
            $table->decimal('original_amount', 15, 2)->nullable();

            // Positive pays more, negative recovers. One column, signed, because
            // "add 500" and "take back 500" are the same kind of decision.
            $table->decimal('amount', 15, 2);
            $table->string('currency', 3)->default('EGP');

            $table->string('reason', 500);
            $table->text('notes')->nullable();

            // pending|approved|rejected|applied|cancelled
            $table->string('status', 20)->default('pending');

            $table->unsignedBigInteger('requested_by')->nullable();
            $table->timestamp('requested_at');
            $table->unsignedBigInteger('approved_by')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->string('decision_note', 500)->nullable();
            $table->timestamp('applied_at')->nullable();
            $table->foreignUuid('applied_payslip_id')->nullable()
                ->constrained('hr_payslips')->nullOnDelete();

            $table->timestamps();

            $table->unique(['company_id', 'reference'], 'hr_comp_adjustment_ref_uq');
            $table->index(['company_id', 'status'], 'hr_comp_adjustment_status_idx');
            $table->index(['employee_id', 'status'], 'hr_comp_adjustment_employee_idx');
            $table->index(['payroll_period_id', 'status'], 'hr_comp_adjustment_period_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_compensation_adjustments');
    }
};
