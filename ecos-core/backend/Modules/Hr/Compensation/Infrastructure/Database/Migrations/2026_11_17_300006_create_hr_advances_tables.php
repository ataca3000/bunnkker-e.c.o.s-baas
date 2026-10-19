<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * HR & Workforce OS — EPIC H3. Advances and their installment schedule.
 *
 * ┌─ MONEY LENT, RECOVERED ON A SCHEDULE ───────────────────────────────────┐
 * │ A one-time advance is recovered whole in the next period; an installment   │
 * │ advance is recovered over several. Either way the SCHEDULE is written up   │
 * │ front, so the remaining balance is never guessed — it is the sum of the    │
 * │ installments still outstanding, and each recovery is tied to the payslip   │
 * │ that took it.                                                             │
 * │                                                                            │
 * │ HR records the advance and recovers it from pay. Finance disburses the     │
 * │ money and owns the cash side; nothing here posts an entry.                 │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('hr_advances')) {
            Schema::create('hr_advances', function (Blueprint $table): void {
                $table->uuid('id')->primary();
                $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
                $table->foreignUuid('employee_id')->constrained('hr_employees')->cascadeOnDelete();

                $table->string('reference', 40);
                $table->string('type', 20)->default('one_time');   // one_time | installment
                $table->decimal('amount', 20, 2);
                $table->char('currency', 3)->default('EGP');
                $table->unsignedSmallInteger('installments_count')->default(1);
                $table->decimal('installment_amount', 20, 2)->default(0);

                $table->date('requested_on');
                $table->date('first_recovery_date')->nullable();
                $table->string('status', 20)->default('pending');  // pending|approved|active|settled|cancelled
                $table->string('reason', 400)->nullable();

                $table->unsignedBigInteger('approved_by')->nullable();
                $table->timestamp('approved_at')->nullable();
                $table->timestamp('settled_at')->nullable();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->timestamps();

                $table->unique(['company_id', 'reference'], 'hr_advance_reference_unique');
                $table->index(['company_id', 'employee_id', 'status'], 'hr_advance_employee_idx');
            });
        }

        if (! Schema::hasTable('hr_advance_installments')) {
            Schema::create('hr_advance_installments', function (Blueprint $table): void {
                $table->uuid('id')->primary();
                $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
                $table->foreignUuid('advance_id')->constrained('hr_advances')->cascadeOnDelete();
                $table->foreignUuid('payroll_period_id')->nullable()->constrained('hr_payroll_periods')->nullOnDelete();

                $table->unsignedSmallInteger('sequence');
                $table->decimal('amount', 20, 2);
                $table->date('due_date');
                $table->string('status', 20)->default('scheduled');   // scheduled|recovered|waived|cancelled
                $table->timestamp('recovered_at')->nullable();
                $table->uuid('payslip_id')->nullable();                // the payslip that recovered it
                $table->string('notes', 300)->nullable();
                $table->timestamps();

                $table->unique(['advance_id', 'sequence'], 'hr_advance_installment_unique');
                $table->index(['company_id', 'status', 'due_date'], 'hr_advance_installment_due_idx');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_advance_installments');
        Schema::dropIfExists('hr_advances');
    }
};
