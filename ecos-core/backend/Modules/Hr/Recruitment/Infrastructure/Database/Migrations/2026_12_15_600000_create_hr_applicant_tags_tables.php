<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * HR V1 enhancements — applicant tags.
 *
 * ┌─ A CATALOGUE, NOT FREE TEXT ────────────────────────────────────────────┐
 * │ "Urgent", "urgent" and "URGENT " are the same intent and three different   │
 * │ strings, so a tag typed per applicant can never be filtered on reliably.   │
 * │ Tags are therefore company-owned rows that applicants are ASSIGNED, which   │
 * │ is what makes "show me every VIP candidate" a query instead of a guess.     │
 * │                                                                            │
 * │ hr_applicants.talent_pool_tags (free-text json, H5) is left exactly as it   │
 * │ is. Nothing reads it here and nothing writes it here.                      │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('hr_applicant_tags')) {
            Schema::create('hr_applicant_tags', function (Blueprint $table): void {
                $table->uuid('id')->primary();
                $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();

                $table->string('key', 60);           // excellent_candidate|urgent|referred|vip|…
                $table->string('name', 80);
                $table->string('description', 300)->nullable();

                // Colour is presentation, but it belongs to the tag rather than the
                // screen — the same tag must look the same everywhere it appears.
                $table->string('color', 20)->default('slate');

                $table->boolean('is_active')->default(true);
                $table->unsignedSmallInteger('sequence')->default(100);

                $table->unsignedBigInteger('created_by')->nullable();
                $table->timestamps();

                $table->unique(['company_id', 'key'], 'hr_applicant_tag_key_uq');
                $table->index(['company_id', 'is_active'], 'hr_applicant_tag_active_idx');
            });
        }

        if (! Schema::hasTable('hr_applicant_tag_assignments')) {
            Schema::create('hr_applicant_tag_assignments', function (Blueprint $table): void {
                $table->uuid('id')->primary();
                $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
                $table->foreignUuid('applicant_id')->constrained('hr_applicants')->cascadeOnDelete();
                $table->foreignUuid('tag_id')->constrained('hr_applicant_tags')->cascadeOnDelete();

                $table->string('note', 300)->nullable();

                $table->unsignedBigInteger('assigned_by')->nullable();
                $table->timestamp('assigned_at');
                $table->timestamps();

                // One applicant carries a tag once. Assigning it twice is not two facts.
                $table->unique(['applicant_id', 'tag_id'], 'hr_applicant_tag_assign_uq');
                $table->index(['company_id', 'tag_id'], 'hr_applicant_tag_lookup_idx');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_applicant_tag_assignments');
        Schema::dropIfExists('hr_applicant_tags');
    }
};
