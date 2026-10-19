<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * HR V1 enhancements — employee exit.
 *
 * ┌─ LEAVING IS A PROCESS, NOT A STATUS CHANGE ─────────────────────────────┐
 * │ Setting someone's status to "resigned" takes a second and settles nothing:  │
 * │ the laptop is still at their house, the access card still opens the door,   │
 * │ and Finance has not been told. So an exit is a process with a checklist,    │
 * │ and it cannot be completed while a MANDATORY item is outstanding.           │
 * │                                                                            │
 * │ This lives beside employee lifecycle rather than in Workforce because       │
 * │ completing an exit writes a Separated lifecycle event, and that record has  │
 * │ exactly one writer. A second one here would put two versions of an          │
 * │ employee's history in the database.                                        │
 * │                                                                            │
 * │ Every item names a RESPONSIBLE PERSON. "IT clearance" that belongs to       │
 * │ nobody is how an exit sits open for three months.                          │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('hr_exit_processes')) {
            Schema::create('hr_exit_processes', function (Blueprint $table): void {
                $table->uuid('id')->primary();
                $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
                $table->foreignUuid('employee_id')->constrained('hr_employees')->cascadeOnDelete();

                $table->string('reference', 40);

                // resignation|termination|retirement
                $table->string('type', 20);
                // initiated|in_progress|completed|cancelled
                $table->string('status', 20)->default('initiated');

                $table->date('notice_date')->nullable();     // when they told us / we told them
                $table->date('last_working_day');
                $table->date('completed_on')->nullable();

                $table->string('reason', 500)->nullable();
                $table->text('notes')->nullable();

                // Rehire eligibility is a judgement made at exit, and it is the one
                // thing anyone actually looks up years later.
                $table->boolean('is_rehire_eligible')->nullable();
                $table->string('rehire_note', 300)->nullable();

                $table->unsignedBigInteger('initiated_by')->nullable();
                $table->unsignedBigInteger('completed_by')->nullable();
                $table->timestamps();

                $table->unique(['company_id', 'reference'], 'hr_exit_reference_uq');
                $table->index(['company_id', 'status'], 'hr_exit_status_idx');
                $table->index(['employee_id', 'status'], 'hr_exit_employee_idx');
                $table->index(['company_id', 'last_working_day'], 'hr_exit_lwd_idx');
            });
        }

        if (! Schema::hasTable('hr_exit_checklist_items')) {
            Schema::create('hr_exit_checklist_items', function (Blueprint $table): void {
                $table->uuid('id')->primary();
                $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
                $table->foreignUuid('exit_process_id')->constrained('hr_exit_processes')->cascadeOnDelete();

                $table->string('key', 60);           // laptop_returned|it_clearance|…
                $table->string('label', 150);
                // asset|clearance|approval
                $table->string('category', 20)->default('asset');

                // A mandatory item blocks completion. An optional one is a reminder.
                $table->boolean('is_mandatory')->default(true);

                // pending|completed|waived|not_applicable
                $table->string('status', 20)->default('pending');

                $table->foreignUuid('responsible_employee_id')->nullable()->constrained('hr_employees')->nullOnDelete();
                $table->date('due_date')->nullable();
                $table->date('completed_on')->nullable();
                $table->string('notes', 500)->nullable();

                // Optional evidence — the signed clearance, the photo of the returned
                // laptop. Same private-disk convention as applicant attachments.
                $table->string('file_path', 400)->nullable();
                $table->string('file_name', 200)->nullable();
                $table->string('mime_type', 120)->nullable();
                $table->unsignedBigInteger('file_size')->nullable();

                // Waiving a mandatory item is allowed, but it is a decision on the
                // record with a name against it — never a silent skip.
                $table->string('waiver_reason', 400)->nullable();
                $table->unsignedBigInteger('waived_by')->nullable();

                $table->unsignedBigInteger('completed_by')->nullable();
                $table->unsignedSmallInteger('sequence')->default(100);
                $table->timestamps();

                $table->index(['exit_process_id', 'status'], 'hr_exit_item_status_idx');
                $table->index(['company_id', 'responsible_employee_id'], 'hr_exit_item_owner_idx');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_exit_checklist_items');
        Schema::dropIfExists('hr_exit_processes');
    }
};
