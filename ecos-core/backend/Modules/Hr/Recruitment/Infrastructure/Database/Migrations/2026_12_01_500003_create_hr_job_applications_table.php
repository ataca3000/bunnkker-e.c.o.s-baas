<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * HR & Workforce OS — EPIC H5. Job applications.
 *
 * One person applying to one opening. The applicant is the PERSON; this is the
 * candidacy — which is why the same applicant can appear against several
 * openings, and why moving someone to the talent pool keeps their applications
 * intact rather than erasing them.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('hr_job_applications')) {
            return;
        }

        Schema::create('hr_job_applications', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignUuid('job_opening_id')->constrained('hr_job_openings')->cascadeOnDelete();
            $table->foreignUuid('applicant_id')->constrained('hr_applicants')->cascadeOnDelete();
            $table->foreignUuid('current_stage_id')->nullable()->constrained('hr_recruitment_stages')->nullOnDelete();

            $table->string('application_number', 40);

            // Professional information supplied on the form.
            $table->decimal('years_experience', 5, 2)->nullable();
            $table->string('current_employer', 200)->nullable();
            $table->string('previous_employer', 200)->nullable();
            $table->decimal('expected_salary', 20, 2)->nullable();
            $table->char('currency', 3)->default('EGP');
            $table->date('available_from')->nullable();
            $table->text('additional_notes')->nullable();

            // in_pipeline|accepted|rejected|hold|talent_pool|offer_sent|offer_accepted|offer_declined|withdrawn
            $table->string('status', 20)->default('in_pipeline');
            $table->string('source', 40)->default('careers_portal');

            $table->timestamp('applied_at');
            $table->timestamp('decided_at')->nullable();
            $table->unsignedBigInteger('decided_by')->nullable();
            $table->string('decision_reason', 400)->nullable();

            // A deterministic, explainable fit score — the seam AI would later plug into.
            $table->unsignedTinyInteger('match_score')->nullable();
            $table->json('match_explanation')->nullable();

            $table->timestamps();

            $table->unique(['company_id', 'application_number'], 'hr_application_number_unique');
            // The same person cannot apply twice to the same opening.
            $table->unique(['job_opening_id', 'applicant_id'], 'hr_application_unique');
            $table->index(['company_id', 'status'], 'hr_application_status_idx');
            $table->index(['company_id', 'job_opening_id', 'current_stage_id'], 'hr_application_pipeline_idx');
            $table->index(['company_id', 'applied_at'], 'hr_application_date_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_job_applications');
    }
};
