<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * HR & Workforce OS — EPIC H5. Stage events, evaluations, interviews, attachments.
 *
 * ┌─ EVERY MOVE IS ON THE RECORD ───────────────────────────────────────────┐
 * │ Stage transitions are an APPEND-ONLY log, not a column that gets           │
 * │ overwritten. "Why was this candidate rejected after the second interview"  │
 * │ is a question the pipeline must be able to answer months later, and only   │
 * │ a log can answer it.                                                       │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('hr_application_stage_events')) {
            Schema::create('hr_application_stage_events', function (Blueprint $table): void {
                $table->uuid('id')->primary();
                $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
                $table->foreignUuid('application_id')->constrained('hr_job_applications')->cascadeOnDelete();

                $table->foreignUuid('from_stage_id')->nullable()->constrained('hr_recruitment_stages')->nullOnDelete();
                $table->foreignUuid('to_stage_id')->nullable()->constrained('hr_recruitment_stages')->nullOnDelete();

                $table->string('action', 40);        // applied|advanced|moved_back|decided|talent_pool|withdrawn
                $table->string('from_status', 20)->nullable();
                $table->string('to_status', 20)->nullable();
                $table->string('note', 400)->nullable();

                $table->unsignedBigInteger('actor_id')->nullable();
                $table->timestamp('occurred_at');
                $table->timestamps();

                $table->index(['application_id', 'occurred_at'], 'hr_stage_event_idx');
            });
        }

        if (! Schema::hasTable('hr_application_evaluations')) {
            Schema::create('hr_application_evaluations', function (Blueprint $table): void {
                $table->uuid('id')->primary();
                $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
                $table->foreignUuid('application_id')->constrained('hr_job_applications')->cascadeOnDelete();
                $table->foreignUuid('stage_id')->nullable()->constrained('hr_recruitment_stages')->nullOnDelete();
                $table->foreignUuid('reviewer_employee_id')->nullable()->constrained('hr_employees')->nullOnDelete();

                // A named rating and its numeric equivalent — a company may use either.
                $table->string('rating', 20);        // excellent|very_good|good|average|weak
                $table->unsignedTinyInteger('score')->nullable();   // 0..100
                $table->text('comments')->nullable();
                $table->timestamp('evaluated_at');

                $table->unsignedBigInteger('created_by')->nullable();
                $table->timestamps();

                $table->index(['application_id', 'evaluated_at'], 'hr_evaluation_idx');
            });
        }

        if (! Schema::hasTable('hr_interviews')) {
            Schema::create('hr_interviews', function (Blueprint $table): void {
                $table->uuid('id')->primary();
                $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
                $table->foreignUuid('application_id')->constrained('hr_job_applications')->cascadeOnDelete();
                $table->foreignUuid('stage_id')->nullable()->constrained('hr_recruitment_stages')->nullOnDelete();
                $table->foreignUuid('interviewer_employee_id')->nullable()->constrained('hr_employees')->nullOnDelete();

                $table->string('title', 200)->nullable();
                $table->timestamp('scheduled_at');
                $table->unsignedSmallInteger('duration_minutes')->default(60);
                $table->string('mode', 20)->default('onsite');      // onsite|phone|video
                $table->string('location', 300)->nullable();        // room, or the meeting link
                $table->json('panel')->nullable();                  // additional interviewer ids

                $table->string('status', 20)->default('scheduled'); // scheduled|completed|cancelled|no_show
                $table->string('decision', 20)->nullable();         // proceed|reject|hold|undecided
                $table->text('notes')->nullable();
                $table->timestamp('occurred_at')->nullable();

                $table->unsignedBigInteger('created_by')->nullable();
                $table->timestamps();

                $table->index(['company_id', 'scheduled_at'], 'hr_interview_schedule_idx');
                $table->index(['application_id', 'status'], 'hr_interview_application_idx');
            });
        }

        if (! Schema::hasTable('hr_applicant_attachments')) {
            Schema::create('hr_applicant_attachments', function (Blueprint $table): void {
                $table->uuid('id')->primary();
                $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
                $table->foreignUuid('applicant_id')->constrained('hr_applicants')->cascadeOnDelete();
                $table->foreignUuid('application_id')->nullable()->constrained('hr_job_applications')->cascadeOnDelete();
                $table->uuid('interview_id')->nullable();

                $table->string('type', 30)->default('cv');   // cv|photo|certificate|other
                $table->string('title', 200);
                $table->string('file_path', 400);
                $table->string('file_name', 200);
                $table->string('mime_type', 120)->nullable();
                $table->unsignedBigInteger('file_size')->nullable();

                // Uploaded through the public portal rather than by a member of staff.
                $table->boolean('is_public_upload')->default(false);
                $table->unsignedBigInteger('uploaded_by')->nullable();
                $table->timestamps();

                $table->index(['company_id', 'applicant_id'], 'hr_attachment_applicant_idx');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_applicant_attachments');
        Schema::dropIfExists('hr_interviews');
        Schema::dropIfExists('hr_application_evaluations');
        Schema::dropIfExists('hr_application_stage_events');
    }
};
