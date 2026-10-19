<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Phase 4 — Exception registry, escalation, notes and alert rules.
 *
 * ┌─ THE CONFLICT FRAMEWORK IS REUSED, NOT REPLACED ────────────────────────┐
 * │ Phase 3's dispatch_conflicts remains the detector and the authority for  │
 * │ dispatch clashes. An exception may POINT at a conflict                   │
 * │ (source_conflict_id) but never restates its judgement, and resolving an  │
 * │ exception does not resolve the conflict — the owning module does that.   │
 * │                                                                          │
 * │ The registry exists because an operator should work ONE queue regardless │
 * │ of which subsystem produced the problem (§7.4).                          │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Deduplication is mandatory. A carrier outage that produces 400 identical rows
 * has produced zero usable information, so a repeat increments a counter on the
 * live row instead of inserting another one.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ops_exceptions', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id')->nullable();

            // Which module owns the underlying fact. Same vocabulary as
            // ConflictType::authority() so the two feeds agree.
            $table->string('source', 20);
            $table->string('category', 30);
            $table->string('exception_type', 60);
            $table->string('severity', 20)->default('warning');

            // open | acknowledged | escalated | resolved | suppressed | auto_resolved
            $table->string('status', 20)->default('open');

            $table->string('title', 200);
            $table->text('description')->nullable();
            $table->json('context')->nullable();

            // What the exception is about, in the owning module's own ids.
            $table->string('subject_type', 40)->nullable();
            $table->string('subject_id', 64)->nullable();

            // The Phase 3 conflict this was raised from, when there is one.
            $table->foreignId('source_conflict_id')->nullable()
                ->constrained('dispatch_conflicts')->nullOnDelete();

            $table->timestamp('first_seen_at');
            $table->timestamp('last_seen_at');
            $table->unsignedInteger('occurrence_count')->default(1);

            $table->timestamp('acknowledged_at')->nullable();
            $table->unsignedBigInteger('acknowledged_by')->nullable();
            $table->string('acknowledged_by_name', 150)->nullable();

            $table->timestamp('resolved_at')->nullable();
            $table->unsignedBigInteger('resolved_by')->nullable();
            $table->string('resolved_by_name', 150)->nullable();
            $table->string('resolution', 40)->nullable();
            $table->text('resolution_reason')->nullable();

            $table->unsignedSmallInteger('escalation_level')->default(0);

            $table->timestamps();

            // Deduplication: at most one LIVE exception per key. Nullable flag
            // inside a plain unique index, so a resolved row frees the key.
            $table->string('dedup_key', 191);
            $table->unsignedTinyInteger('active_flag')->nullable()->default(1);
            $table->unique(['dedup_key', 'active_flag'], 'ops_exception_dedup_unique');

            $table->index(['company_id', 'status', 'severity'], 'ops_exception_queue_idx');
            $table->index(['source', 'status'], 'ops_exception_source_idx');
            $table->index(['category', 'status'], 'ops_exception_category_idx');
            $table->index(['last_seen_at'], 'ops_exception_recency_idx');
        });

        Schema::create('ops_exception_escalations', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id')->nullable();
            $table->foreignId('exception_id')
                ->constrained('ops_exceptions')->cascadeOnDelete();

            $table->unsignedSmallInteger('level');
            $table->string('escalated_to_role', 60)->nullable();
            $table->unsignedBigInteger('escalated_to_user_id')->nullable();

            // Escalating without saying why hands the next person a problem
            // with no context, which is how escalations stall.
            $table->text('reason');

            // manual | unacknowledged_timeout | severity_increase
            $table->string('trigger', 30)->default('manual');

            $table->timestamp('escalated_at');
            $table->unsignedBigInteger('escalated_by')->nullable();
            $table->string('escalated_by_name', 150)->nullable();

            $table->timestamp('acknowledged_at')->nullable();
            $table->unsignedBigInteger('acknowledged_by')->nullable();

            $table->timestamps();

            $table->index(['exception_id', 'level'], 'ops_escalation_exception_idx');
            $table->index(['company_id', 'escalated_at'], 'ops_escalation_time_idx');
        });

        // APPEND-ONLY. The running commentary on an exception — what was tried,
        // what was ruled out. Editing it would rewrite the reasoning.
        Schema::create('ops_exception_notes', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id')->nullable();
            $table->foreignId('exception_id')
                ->constrained('ops_exceptions')->cascadeOnDelete();

            $table->text('body');
            // note | action_taken | handover
            $table->string('note_type', 20)->default('note');

            // A handover note is what the next shift reads first.
            $table->boolean('is_pinned')->default(false);

            $table->timestamp('written_at');
            $table->unsignedBigInteger('author_id')->nullable();
            $table->string('author_name', 150)->nullable();

            $table->timestamps();

            $table->index(['exception_id', 'written_at'], 'ops_note_exception_idx');
        });

        // Configuration, not a second lifecycle: a rule decides which
        // exceptions become alerts and how fast they escalate. The exception
        // registry above remains the single record of the problem itself.
        Schema::create('ops_alert_rules', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id')->nullable();

            $table->string('name', 150);
            $table->string('source', 20)->nullable();
            $table->string('category', 30)->nullable();
            $table->string('exception_type', 60)->nullable();
            $table->string('min_severity', 20)->default('warning');

            $table->boolean('is_active')->default(true);

            // Unacknowledged for this long → escalate. Null means never.
            $table->unsignedSmallInteger('escalate_after_minutes')->nullable();
            $table->string('escalate_to_role', 60)->nullable();

            // While true, matching exceptions are recorded but raise no alert.
            $table->boolean('suppress')->default(false);
            $table->text('suppress_reason')->nullable();

            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'is_active'], 'ops_alert_rule_active_idx');
            $table->index(['source', 'category'], 'ops_alert_rule_match_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ops_alert_rules');
        Schema::dropIfExists('ops_exception_notes');
        Schema::dropIfExists('ops_exception_escalations');
        Schema::dropIfExists('ops_exceptions');
    }
};
