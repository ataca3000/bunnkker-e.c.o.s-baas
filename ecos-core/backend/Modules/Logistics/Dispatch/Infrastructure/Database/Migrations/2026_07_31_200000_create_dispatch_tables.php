<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Dispatch — which trip gets which resources, now.
 *
 * ┌─ DIRECTIVES 5, 6, 11 ───────────────────────────────────────────────────┐
 * │ Dispatch PROPOSES; V1 COMMITS.                                          │
 * │                                                                          │
 * │ Vehicle and driver are referenced BY ID and no attribute of either is    │
 * │ stored — what Dispatch owns is the SCORE and the REASON.                 │
 * │                                                                          │
 * │ dispatch_releases records the ids returned by Distribution's TripService │
 * │ and Drivers' DriverVehicleAssignmentService, so "we went through V1"     │
 * │ is auditable in the data and not merely a claim about the code.          │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dispatch_policies', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id');
            $table->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete();

            $table->string('code', 40);
            $table->string('name', 150);
            $table->unsignedSmallInteger('version')->default(1);

            // Scoring weights — configuration, not code, so a dispatcher's
            // priorities can change without a deploy.
            $table->unsignedTinyInteger('weight_capacity_fit')->default(40);
            $table->unsignedTinyInteger('weight_fitness')->default(30);
            $table->unsignedTinyInteger('weight_zone_affinity')->default(20);
            $table->unsignedTinyInteger('weight_utilisation')->default(10);

            // Auto-release is opt-in per policy; the default is a human.
            $table->boolean('allow_auto_release')->default(false);
            $table->boolean('is_active')->default(true);
            $table->unsignedTinyInteger('active_flag')->nullable()->default(1);

            $table->timestamps();

            $table->unique(['company_id', 'code', 'active_flag'], 'dispatch_policy_live_unique');
        });

        Schema::create('dispatch_boards', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id');
            $table->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete();

            // The origin. A dispatch region (Network) or a raw warehouse.
            $table->foreignId('dispatch_region_id')->nullable()
                ->constrained('network_dispatch_regions')->nullOnDelete();
            $table->uuid('warehouse_id')->nullable();

            $table->date('board_date');
            $table->string('status', 30)->default('open');
            $table->text('status_reason')->nullable();

            $table->timestamp('planned_at')->nullable();
            $table->timestamp('released_at')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();

            $table->timestamps();

            $table->unique(
                ['company_id', 'dispatch_region_id', 'board_date'],
                'dispatch_board_origin_date_unique',
            );
            $table->index(['company_id', 'status'], 'dispatch_board_company_status_idx');
        });

        Schema::create('dispatch_proposals', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->foreignId('dispatch_board_id')
                ->constrained('dispatch_boards')->cascadeOnDelete();
            $table->foreignId('dispatch_policy_id')->nullable()
                ->constrained('dispatch_policies')->nullOnDelete();
            $table->uuid('company_id')->nullable();

            $table->string('status', 20)->default('generated');
            $table->unsignedSmallInteger('assignment_count')->default(0);
            $table->unsignedSmallInteger('blocked_count')->default(0);

            // Immutable audit of the resource pool the proposal was computed
            // against, so a decision stays explainable weeks later.
            $table->json('pool_snapshot')->nullable();

            $table->timestamp('decided_at')->nullable();
            $table->unsignedBigInteger('decided_by')->nullable();
            $table->text('decision_reason')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();

            $table->timestamps();

            $table->index(['dispatch_board_id', 'status'], 'dispatch_proposal_board_idx');
        });

        Schema::create('dispatch_proposed_assignments', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->foreignId('dispatch_proposal_id')
                ->constrained('dispatch_proposals')->cascadeOnDelete();

            // V1 by reference. No plate, no driver name, no capacity — Dispatch
            // owns the SCORE and the REASON, never the master data.
            $table->unsignedBigInteger('trip_id')->nullable();
            $table->foreign('trip_id')->references('id')->on('distribution_trips')->nullOnDelete();
            $table->unsignedBigInteger('vehicle_id')->nullable();
            $table->foreign('vehicle_id')->references('id')->on('logistics_vehicles')->nullOnDelete();
            $table->unsignedBigInteger('driver_id')->nullable();
            $table->foreign('driver_id')->references('id')->on('logistics_drivers')->nullOnDelete();

            $table->string('status', 20)->default('proposed');
            $table->unsignedSmallInteger('score')->default(0);
            $table->json('score_breakdown')->nullable();

            // The fitness answer at proposal time, from Fleet's public query
            // interface. Snapshotted so the board explains itself even after
            // the vehicle's condition changes.
            $table->string('fitness_level', 30)->nullable();

            $table->timestamps();

            $table->index(['dispatch_proposal_id', 'status'], 'dispatch_assign_proposal_idx');
            $table->index('trip_id', 'dispatch_assign_trip_idx');
        });

        Schema::create('dispatch_assignment_blockers', function (Blueprint $table): void {
            $table->id();

            $table->foreignId('assignment_id')
                ->constrained('dispatch_proposed_assignments')->cascadeOnDelete();

            $table->string('source', 30);       // fleet | driver | trip | capacity | policy
            $table->text('reason');
            $table->boolean('is_hard')->default(true);

            $table->timestamps();

            $table->index('assignment_id', 'dispatch_blocker_assignment_idx');
        });

        Schema::create('dispatch_releases', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->foreignId('dispatch_proposal_id')
                ->constrained('dispatch_proposals')->cascadeOnDelete();
            $table->foreignId('assignment_id')->nullable()
                ->constrained('dispatch_proposed_assignments')->nullOnDelete();

            $table->boolean('succeeded')->default(false);

            // ── The audit trail that proves V1 committed the change ──────────
            $table->unsignedBigInteger('v1_trip_id')->nullable();
            $table->unsignedBigInteger('v1_assignment_id')->nullable();
            $table->text('failure_reason')->nullable();

            $table->timestamp('released_at');
            $table->unsignedBigInteger('released_by')->nullable();
            $table->timestamps();

            $table->index(['dispatch_proposal_id', 'succeeded'], 'dispatch_release_proposal_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dispatch_releases');
        Schema::dropIfExists('dispatch_assignment_blockers');
        Schema::dropIfExists('dispatch_proposed_assignments');
        Schema::dropIfExists('dispatch_proposals');
        Schema::dropIfExists('dispatch_boards');
        Schema::dropIfExists('dispatch_policies');
    }
};
