<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * HR & Workforce OS — EPIC H2. Daily attendance.
 *
 * ┌─ ONE ROW PER EMPLOYEE PER DAY · REGISTERED BY HAND ─────────────────────┐
 * │ A supervisor records what happened: present, absent, on leave, a holiday or │
 * │ a rest day. Check-in and check-out are optional notes of when someone       │
 * │ actually arrived and left — recorded facts, never totalled into hours,      │
 * │ overtime or time off in lieu.                                              │
 * │                                                                            │
 * │ There is deliberately no device integration of any kind: no fingerprint     │
 * │ reader, no RFID, no QR code, no GPS, no mobile capture. `source` exists to  │
 * │ record that a human entered this, and an audit trail of who.               │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('hr_attendance_days')) {
            return;
        }

        Schema::create('hr_attendance_days', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignUuid('employee_id')->constrained('hr_employees')->cascadeOnDelete();
            $table->foreignUuid('department_id')->nullable()->constrained('hr_departments')->nullOnDelete();
            $table->foreignUuid('shift_id')->nullable()->constrained('hr_shifts')->nullOnDelete();

            $table->date('work_date');
            $table->string('status', 20);          // present | absent | leave | holiday | rest_day
            $table->time('check_in')->nullable();
            $table->time('check_out')->nullable();
            $table->string('source', 20)->default('manual');   // manual registration only
            $table->uuid('leave_request_id')->nullable();      // set when the day came from an approved leave
            $table->string('notes', 300)->nullable();

            $table->unsignedBigInteger('registered_by')->nullable();
            $table->timestamps();

            // One record per person per day — registering twice corrects, never duplicates.
            $table->unique(['employee_id', 'work_date'], 'hr_attendance_day_unique');
            $table->index(['company_id', 'work_date', 'status'], 'hr_attendance_date_idx');
            $table->index(['company_id', 'department_id', 'work_date'], 'hr_attendance_department_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_attendance_days');
    }
};
