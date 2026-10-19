<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Phase 3 — Review/approval, timeline and audit.
 *
 * The review workflow exists for the same reason POD capture and validation are
 * separate permissions in LOG-005: a decision that carries risk should not be
 * self-certified. An automatic assignment proposes; a human approves.
 *
 * The audit trail is APPEND-ONLY. It answers "who did what, when, and why" for
 * every consequential dispatch action, which is precisely what is missing when
 * a morning goes wrong and nobody can reconstruct it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dispatch_assignment_reviews', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id')->nullable();
            $table->foreignId('assignment_id')
                ->constrained('dispatch_proposed_assignments')->cascadeOnDelete();
            $table->foreignId('dispatch_session_id')->nullable()
                ->constrained('dispatch_sessions')->nullOnDelete();

            $table->string('status', 20)->default('pending');

            // Why this assignment needed a human at all.
            $table->string('trigger', 40);       // automatic | conflict | override | policy | manual
            $table->text('trigger_reason')->nullable();

            $table->timestamp('requested_at');
            $table->unsignedBigInteger('requested_by')->nullable();

            $table->timestamp('decided_at')->nullable();
            $table->unsignedBigInteger('decided_by')->nullable();
            $table->string('decided_by_name', 150)->nullable();
            $table->text('decision_reason')->nullable();

            $table->timestamps();

            // One open review per assignment; nullable-flag partial unique.
            $table->unsignedTinyInteger('active_flag')->nullable()->default(1);
            $table->unique(['assignment_id', 'active_flag'], 'dispatch_review_one_open_unique');
            $table->index(['company_id', 'status'], 'dispatch_review_company_status_idx');
        });

        Schema::create('dispatch_timeline_events', function (Blueprint $table): void {
            $table->id();

            $table->uuid('company_id')->nullable();
            $table->foreignId('dispatch_board_id')->nullable()
                ->constrained('dispatch_boards')->cascadeOnDelete();
            $table->foreignId('dispatch_session_id')->nullable()
                ->constrained('dispatch_sessions')->cascadeOnDelete();
            $table->foreignId('assignment_id')->nullable()
                ->constrained('dispatch_proposed_assignments')->nullOnDelete();

            $table->string('event_type', 40);
            $table->string('severity', 20)->default('info');
            $table->string('title', 200);
            $table->text('description')->nullable();
            $table->json('metadata')->nullable();

            $table->timestamp('occurred_at');
            $table->unsignedBigInteger('actor_id')->nullable();
            $table->string('actor_name', 150)->nullable();

            $table->timestamps();

            // The board timeline read path.
            $table->index(['dispatch_board_id', 'occurred_at'], 'dispatch_timeline_board_idx');
            $table->index(['dispatch_session_id', 'occurred_at'], 'dispatch_timeline_session_idx');
            $table->index(['company_id', 'severity'], 'dispatch_timeline_severity_idx');
        });

        Schema::create('dispatch_audit_entries', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id')->nullable();
            $table->foreignId('assignment_id')->nullable()
                ->constrained('dispatch_proposed_assignments')->nullOnDelete();
            $table->foreignId('dispatch_session_id')->nullable()
                ->constrained('dispatch_sessions')->nullOnDelete();

            $table->string('action', 40);
            $table->string('entity_type', 40)->nullable();
            $table->string('entity_id', 64)->nullable();

            // Before/after for the fields that changed. Kept narrow on purpose:
            // a full row snapshot would balloon and obscure what actually moved.
            $table->json('changes')->nullable();

            // An override or a forced resolution MUST carry a reason. The
            // column is nullable because routine actions do not need one, but
            // the services refuse the risky ones without it.
            $table->text('reason')->nullable();

            $table->timestamp('performed_at');
            $table->unsignedBigInteger('actor_id')->nullable();
            $table->string('actor_name', 150)->nullable();
            $table->string('ip_address', 45)->nullable();

            $table->timestamps();

            $table->index(['company_id', 'performed_at'], 'dispatch_audit_company_time_idx');
            $table->index(['assignment_id', 'action'], 'dispatch_audit_assignment_idx');
            $table->index(['action', 'performed_at'], 'dispatch_audit_action_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dispatch_audit_entries');
        Schema::dropIfExists('dispatch_timeline_events');
        Schema::dropIfExists('dispatch_assignment_reviews');
    }
};
