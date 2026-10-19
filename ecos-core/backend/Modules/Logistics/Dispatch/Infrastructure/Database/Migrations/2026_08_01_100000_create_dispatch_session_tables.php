<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Phase 3 — Dispatch Execution: sessions, the queue, and locks.
 *
 * ┌─ ADDITIVE ONLY (DIRECTIVE 14) ──────────────────────────────────────────┐
 * │ No Phase 2 table is altered. A session REFERENCES a board; the queue     │
 * │ REFERENCES trips; locks REFERENCE vehicles and drivers. Everything Phase │
 * │ 2 built keeps working untouched if Phase 3 is never used.                │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * A SESSION is a dispatcher's working window over a board. It exists because
 * batch dispatch, locks and the audit trail all need something to attribute
 * work to — "who was dispatching when this happened" is unanswerable without it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dispatch_sessions', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id');
            $table->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete();

            $table->foreignId('dispatch_board_id')
                ->constrained('dispatch_boards')->cascadeOnDelete();

            $table->string('status', 20)->default('open');
            $table->string('mode', 20)->default('manual');   // manual | automatic | hybrid

            $table->timestamp('started_at');
            $table->timestamp('ended_at')->nullable();
            $table->unsignedBigInteger('operator_id')->nullable();
            $table->string('operator_name', 150)->nullable();

            // Running tallies, maintained by the session service so the header
            // does not aggregate on every render.
            $table->unsignedSmallInteger('assigned_count')->default(0);
            $table->unsignedSmallInteger('released_count')->default(0);
            $table->unsignedSmallInteger('conflict_count')->default(0);

            $table->text('notes')->nullable();
            $table->text('close_reason')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'status'], 'dispatch_session_company_status_idx');
            $table->index(['dispatch_board_id', 'status'], 'dispatch_session_board_idx');
        });

        Schema::create('dispatch_queue_items', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->foreignId('dispatch_board_id')
                ->constrained('dispatch_boards')->cascadeOnDelete();
            $table->uuid('company_id')->nullable();

            // Distribution owns the trip. Referenced, never written.
            $table->unsignedBigInteger('trip_id');
            $table->foreign('trip_id')->references('id')->on('distribution_trips')->cascadeOnDelete();

            $table->string('status', 20)->default('waiting');
            $table->string('priority', 20)->default('normal');

            // Lower sorts first. Recomputed by the queue service rather than
            // stored by the caller, so ordering cannot be gamed per request.
            $table->unsignedInteger('rank')->default(1000);

            // Why this item sits where it does — a queue that cannot explain
            // its own order is one dispatchers work around.
            $table->string('priority_reason', 200)->nullable();

            $table->timestamp('queued_at');
            $table->timestamp('claimed_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->foreignId('claimed_by_session_id')->nullable()
                ->constrained('dispatch_sessions')->nullOnDelete();

            $table->unsignedSmallInteger('attempt_count')->default(0);
            $table->text('last_failure_reason')->nullable();

            $table->timestamps();

            // One live queue entry per trip per board — emulated partial unique
            // via a nullable flag, the pattern LOG-002 proved.
            $table->unsignedTinyInteger('active_flag')->nullable()->default(1);
            $table->unique(
                ['dispatch_board_id', 'trip_id', 'active_flag'],
                'dispatch_queue_one_live_unique',
            );
            $table->index(['dispatch_board_id', 'status', 'rank'], 'dispatch_queue_order_idx');
        });

        Schema::create('dispatch_assignment_locks', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id')->nullable();
            $table->foreignId('dispatch_session_id')->nullable()
                ->constrained('dispatch_sessions')->cascadeOnDelete();

            // What is held. Exactly one of these is set per lock.
            $table->string('resource_type', 20);          // vehicle | driver | trip
            $table->unsignedBigInteger('resource_id');

            $table->string('status', 20)->default('held');

            // A lock MUST expire. A dispatcher who closes their laptop must not
            // hold a vehicle hostage until someone notices.
            $table->timestamp('acquired_at');
            $table->timestamp('expires_at');
            $table->timestamp('released_at')->nullable();
            $table->text('release_reason')->nullable();

            $table->unsignedBigInteger('held_by')->nullable();
            $table->string('held_by_name', 150)->nullable();

            $table->timestamps();

            // THE MUTUAL-EXCLUSION INVARIANT: one live lock per resource.
            // Enforced by the database, not by application care — two
            // dispatchers must not both believe they hold the same van.
            $table->unsignedTinyInteger('active_flag')->nullable()->default(1);
            $table->unique(
                ['resource_type', 'resource_id', 'active_flag'],
                'dispatch_lock_one_live_unique',
            );
            $table->index(['status', 'expires_at'], 'dispatch_lock_sweep_idx');
            $table->index(['dispatch_session_id', 'status'], 'dispatch_lock_session_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dispatch_assignment_locks');
        Schema::dropIfExists('dispatch_queue_items');
        Schema::dropIfExists('dispatch_sessions');
    }
};
