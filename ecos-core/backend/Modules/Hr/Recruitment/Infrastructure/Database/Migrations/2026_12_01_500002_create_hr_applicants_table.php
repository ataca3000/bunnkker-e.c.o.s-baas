<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * HR & Workforce OS — EPIC H5. Applicants.
 *
 * ┌─ AN APPLICANT IS NOT AN EMPLOYEE ───────────────────────────────────────┐
 * │ Applying creates a row HERE and nowhere else. Someone who applies is a     │
 * │ person the company is considering, not a person it employs, and conflating │
 * │ the two would put strangers in the workforce master. `hired_employee_id`   │
 * │ is set only when a hiring decision is executed, and it is the single link  │
 * │ between the two records.                                                   │
 * │                                                                            │
 * │ The same person often applies more than once. `merged_into_id` points a    │
 * │ duplicate at the record that survived, so their history stays together     │
 * │ without deleting anything they submitted.                                  │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('hr_applicants')) {
            return;
        }

        Schema::create('hr_applicants', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();

            $table->string('applicant_number', 40);
            $table->string('full_name', 200);
            $table->string('mobile', 30);
            $table->string('email', 150)->nullable();
            $table->date('birth_date')->nullable();
            $table->string('city', 100)->nullable();
            $table->string('country', 100)->nullable();

            $table->string('source', 40)->default('careers_portal');   // careers_portal|referral|agency|walk_in|other
            $table->string('status', 20)->default('active');           // active|hired|archived|merged
            $table->text('notes')->nullable();

            // Talent pool — kept for a future opening rather than discarded.
            $table->boolean('in_talent_pool')->default(false);
            $table->timestamp('talent_pool_added_at')->nullable();
            $table->string('talent_pool_note', 400)->nullable();
            $table->json('talent_pool_tags')->nullable();

            $table->foreignUuid('merged_into_id')->nullable()->constrained('hr_applicants')->nullOnDelete();
            $table->foreignUuid('hired_employee_id')->nullable()->constrained('hr_employees')->nullOnDelete();
            $table->timestamp('hired_at')->nullable();

            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['company_id', 'applicant_number'], 'hr_applicant_number_unique');
            // Duplicate detection reads these two.
            $table->index(['company_id', 'mobile'], 'hr_applicant_mobile_idx');
            $table->index(['company_id', 'email'], 'hr_applicant_email_idx');
            $table->index(['company_id', 'in_talent_pool'], 'hr_applicant_talent_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_applicants');
    }
};
