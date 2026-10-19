<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * HR & Workforce OS — EPIC H5. Employee lifecycle events.
 *
 * ┌─ EMPLOYMENT HISTORY, NOT THE CURRENT STATE ─────────────────────────────┐
 * │ The employee record says where someone IS. This says how they got there:   │
 * │ hired, passed probation, transferred, promoted, resigned, terminated.      │
 * │ Append-only, with the before and after of whatever changed, so a           │
 * │ reorganisation two years ago is still readable — the employee row alone    │
 * │ can never answer that, because it only ever holds the latest values.       │
 * │                                                                            │
 * │ `source_reference` links a hire back to the application it came from.      │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('hr_employee_lifecycle_events')) {
            return;
        }

        Schema::create('hr_employee_lifecycle_events', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignUuid('employee_id')->constrained('hr_employees')->cascadeOnDelete();

            // hired|probation_started|probation_passed|confirmed|transferred
            // |position_changed|promoted|suspended|reinstated|resigned|terminated|rehired
            $table->string('event_type', 30);
            $table->date('effective_date');
            $table->string('reason', 400)->nullable();
            $table->text('notes')->nullable();

            // What changed, before and after — kept as data rather than prose.
            $table->json('from_values')->nullable();
            $table->json('to_values')->nullable();

            $table->string('source_module', 40)->nullable();     // recruitment, when hired
            $table->string('source_reference', 64)->nullable();  // the application id
            $table->unsignedBigInteger('actor_id')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'employee_id', 'effective_date'], 'hr_lifecycle_employee_idx');
            $table->index(['company_id', 'event_type', 'effective_date'], 'hr_lifecycle_type_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_employee_lifecycle_events');
    }
};
