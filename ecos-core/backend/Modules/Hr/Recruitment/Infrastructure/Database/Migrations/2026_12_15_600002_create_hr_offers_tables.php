<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * HR V1 enhancements — offer letters.
 *
 * ┌─ THE OFFER IS THE COMMITMENT · THE VERSION IS WHAT WAS SENT ────────────┐
 * │ An offer is one negotiation with one number, and it may be revised several  │
 * │ times before it is accepted. So the TERMS do not live on the offer — they   │
 * │ live on a version, appended each time anything material changes. The offer  │
 * │ row holds identity, status and a pointer at the version currently in play.  │
 * │                                                                            │
 * │ That split is the whole point: "we offered 12,000 and they countered" is a  │
 * │ fact the company must still be able to prove after the number became        │
 * │ 13,500. A revision that overwrote the previous salary would erase it.       │
 * │                                                                            │
 * │ The salary here is an OFFER, not pay. Nothing in Payroll reads this table;  │
 * │ the figure becomes compensation only when hiring passes it to               │
 * │ SalaryStructureService, which owns what people are actually paid.           │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('hr_offers')) {
            Schema::create('hr_offers', function (Blueprint $table): void {
                $table->uuid('id')->primary();
                $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
                $table->foreignUuid('application_id')->constrained('hr_job_applications')->cascadeOnDelete();
                $table->foreignUuid('applicant_id')->constrained('hr_applicants')->cascadeOnDelete();

                $table->string('offer_number', 40);

                // draft|sent|accepted|declined|expired|withdrawn
                $table->string('status', 20)->default('draft');

                $table->unsignedSmallInteger('current_version')->default(1);

                // The dates that decide whether the offer still stands.
                $table->date('expires_on')->nullable();
                $table->timestamp('sent_at')->nullable();
                $table->timestamp('responded_at')->nullable();
                $table->string('response_note', 500)->nullable();
                $table->timestamp('withdrawn_at')->nullable();

                $table->unsignedBigInteger('created_by')->nullable();
                $table->unsignedBigInteger('sent_by')->nullable();
                $table->timestamps();

                $table->unique(['company_id', 'offer_number'], 'hr_offer_number_uq');
                $table->index(['company_id', 'status'], 'hr_offer_status_idx');
                $table->index(['application_id', 'status'], 'hr_offer_application_idx');
                $table->index(['company_id', 'expires_on'], 'hr_offer_expiry_idx');
            });
        }

        if (! Schema::hasTable('hr_offer_versions')) {
            Schema::create('hr_offer_versions', function (Blueprint $table): void {
                $table->uuid('id')->primary();
                $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
                $table->foreignUuid('offer_id')->constrained('hr_offers')->cascadeOnDelete();

                $table->unsignedSmallInteger('version');

                // ── The terms, as offered ──────────────────────────────────────
                $table->string('candidate_name', 150);
                $table->foreignUuid('position_id')->nullable()->constrained('hr_positions')->nullOnDelete();
                $table->foreignUuid('department_id')->nullable()->constrained('hr_departments')->nullOnDelete();
                $table->foreignUuid('employment_type_id')->nullable()->constrained('hr_employment_types')->nullOnDelete();
                $table->uuid('branch_id')->nullable();

                // Denormalised on purpose: what the letter SAID, frozen. Renaming a
                // department later must not rewrite an offer already sent.
                $table->string('position_title', 150)->nullable();
                $table->string('department_name', 150)->nullable();
                $table->string('branch_name', 150)->nullable();
                $table->string('employment_type_name', 100)->nullable();

                $table->date('start_date')->nullable();
                $table->decimal('basic_salary', 15, 2)->default(0);
                $table->string('currency', 3)->default('EGP');
                $table->text('notes')->nullable();

                // Why this revision exists. Blank on the first.
                $table->string('revision_reason', 400)->nullable();

                $table->unsignedBigInteger('created_by')->nullable();
                $table->timestamps();

                $table->unique(['offer_id', 'version'], 'hr_offer_version_uq');
                $table->index(['company_id', 'offer_id'], 'hr_offer_version_lookup_idx');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_offer_versions');
        Schema::dropIfExists('hr_offers');
    }
};
