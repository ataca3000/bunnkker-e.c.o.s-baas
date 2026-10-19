<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * HR & Workforce OS — EPIC H5. Recruitment pipeline stages.
 *
 * The pipeline is CONFIGURED, not coded. Applied → Initial Review → Phone
 * Interview → Interview → Final Interview → Accepted/Rejected is only the
 * default that gets seeded; a company can add, reorder or remove stages without
 * a deployment, and every application carries the stage it is actually on.
 *
 * `type` tells the system what a stage MEANS without hard-coding its name —
 * which stage schedules an interview, and which one ends the pipeline.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('hr_recruitment_stages')) {
            return;
        }

        Schema::create('hr_recruitment_stages', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();

            $table->string('code', 40);
            $table->string('name', 120);
            $table->string('description', 300)->nullable();
            $table->unsignedSmallInteger('sequence')->default(1);

            // applied | screening | interview | offer | decision
            $table->string('type', 20)->default('screening');
            $table->boolean('is_initial')->default(false);   // where a new application lands
            $table->boolean('is_terminal')->default(false);  // the pipeline ends here
            $table->boolean('is_active')->default(true);
            $table->string('color', 20)->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'code'], 'hr_stage_code_unique');
            $table->index(['company_id', 'sequence'], 'hr_stage_sequence_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_recruitment_stages');
    }
};
