<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * HR V1 enhancements — the applicant timeline.
 *
 * ┌─ ONE STORY PER CANDIDATE, TOLD ONCE ────────────────────────────────────┐
 * │ H5 already logs stage moves, evaluations and interviews — each in its own   │
 * │ table, each answering its own question. What nobody could answer was the    │
 * │ simple one a recruiter actually asks: "what has happened with this person?" │
 * │                                                                            │
 * │ This is that answer. It does not replace those tables and it is not their   │
 * │ source of truth — it is the chronological narration alongside them, so the  │
 * │ tag added, the offer sent, the duplicate detected and the interview booked  │
 * │ appear in one ordered list.                                                │
 * │                                                                            │
 * │ APPEND-ONLY. An entry records that something happened at a moment; a        │
 * │ history you can edit is a history nobody can rely on. The model refuses     │
 * │ updates and deletes, and a guard asserts it.                               │
 * │                                                                            │
 * │ `context` carries whatever made the event meaningful — which tag, which     │
 * │ offer, what the score was — so the line renders without a second query and  │
 * │ still reads correctly years later when the referenced row has moved on.     │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('hr_applicant_timeline_events')) {
            return;
        }

        Schema::create('hr_applicant_timeline_events', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignUuid('applicant_id')->constrained('hr_applicants')->cascadeOnDelete();

            // Most events belong to a candidacy; a few (merge, tag, talent pool)
            // are about the person across all of them.
            $table->foreignUuid('application_id')->nullable()->constrained('hr_job_applications')->cascadeOnDelete();

            $table->string('event_type', 40);        // TimelineEventType
            $table->string('title', 200);
            $table->string('summary', 500)->nullable();

            // Grouping for the filter chips: pipeline|decision|offer|interview|
            // evaluation|tag|administrative
            $table->string('category', 30);

            // What the entry points at, without a foreign key — the timeline must
            // survive the referenced row being archived.
            $table->string('subject_type', 40)->nullable();
            $table->string('subject_id', 64)->nullable();

            $table->json('context')->nullable();

            // Recorded by a person, or by the portal when nobody was involved.
            $table->unsignedBigInteger('actor_id')->nullable();
            $table->string('actor_name', 150)->nullable();
            $table->boolean('is_system')->default(false);

            $table->timestamp('occurred_at');
            $table->timestamps();

            $table->index(['applicant_id', 'occurred_at'], 'hr_timeline_applicant_idx');
            $table->index(['application_id', 'occurred_at'], 'hr_timeline_application_idx');
            $table->index(['company_id', 'event_type'], 'hr_timeline_type_idx');
            $table->index(['company_id', 'category'], 'hr_timeline_category_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_applicant_timeline_events');
    }
};
