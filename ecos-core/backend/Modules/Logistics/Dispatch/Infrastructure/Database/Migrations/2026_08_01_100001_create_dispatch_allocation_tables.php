<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Phase 3 — Resource Allocation and conflicts.
 *
 * ┌─ DIRECTIVES 4, 5, 11, 12 — REUSE, NEVER DUPLICATE ──────────────────────┐
 * │ An allocation RECORDS a decision. It does not re-derive it.             │
 * │                                                                          │
 * │   • Vehicle readiness comes from Fleet via FleetReadinessQueryInterface. │
 * │     The verdict LEVEL is snapshotted here for the audit trail; the       │
 * │     judgement is never recomputed in Dispatch.                           │
 * │   • Capacity comes from Network's CapacityLedgerService. This table      │
 * │     holds the COMMITMENT UUID it returned — Dispatch runs no capacity    │
 * │     arithmetic of its own.                                               │
 * │   • Driver fitness comes from LOG-002's canStartDeliveries().            │
 * │                                                                          │
 * │ If this table ever grows an `available_orders` or a `defect_count`       │
 * │ column, business logic has been duplicated and the boundary is broken.   │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dispatch_resource_allocations', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id')->nullable();
            $table->foreignId('dispatch_session_id')->nullable()
                ->constrained('dispatch_sessions')->nullOnDelete();
            $table->foreignId('assignment_id')->nullable()
                ->constrained('dispatch_proposed_assignments')->cascadeOnDelete();

            // V1 by reference. No plate, no driver name, no capacity figure.
            $table->unsignedBigInteger('trip_id')->nullable();
            $table->foreign('trip_id')->references('id')->on('distribution_trips')->nullOnDelete();
            $table->unsignedBigInteger('vehicle_id')->nullable();
            $table->foreign('vehicle_id')->references('id')->on('logistics_vehicles')->nullOnDelete();
            $table->unsignedBigInteger('driver_id')->nullable();
            $table->foreign('driver_id')->references('id')->on('logistics_drivers')->nullOnDelete();

            $table->string('status', 20)->default('proposed');
            $table->string('allocation_mode', 20)->default('manual');   // manual | automatic

            // Snapshots of OTHER modules' verdicts, kept so the decision stays
            // explainable after conditions change. Never recomputed here.
            $table->string('fleet_verdict', 30)->nullable();
            $table->boolean('driver_ready')->nullable();

            // The receipt from Network's capacity ledger. Dispatch holds the
            // reference; Network owns the arithmetic.
            $table->uuid('capacity_commitment_uuid')->nullable();

            $table->timestamp('allocated_at');
            $table->timestamp('confirmed_at')->nullable();
            $table->timestamp('released_at')->nullable();
            $table->text('release_reason')->nullable();
            $table->unsignedBigInteger('allocated_by')->nullable();

            $table->timestamps();

            $table->index(['company_id', 'status'], 'dispatch_alloc_company_status_idx');
            $table->index(['vehicle_id', 'status'], 'dispatch_alloc_vehicle_idx');
            $table->index(['driver_id', 'status'], 'dispatch_alloc_driver_idx');
            $table->index(['trip_id'], 'dispatch_alloc_trip_idx');
        });

        Schema::create('dispatch_conflicts', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id')->nullable();
            $table->foreignId('dispatch_session_id')->nullable()
                ->constrained('dispatch_sessions')->nullOnDelete();
            $table->foreignId('assignment_id')->nullable()
                ->constrained('dispatch_proposed_assignments')->cascadeOnDelete();
            $table->foreignId('allocation_id')->nullable()
                ->constrained('dispatch_resource_allocations')->nullOnDelete();

            $table->string('conflict_type', 40);
            $table->string('severity', 20)->default('blocking');
            $table->string('status', 20)->default('open');

            // What is contended, and by whom.
            $table->string('resource_type', 20)->nullable();
            $table->unsignedBigInteger('resource_id')->nullable();
            $table->unsignedBigInteger('conflicting_allocation_id')->nullable();

            // Always human-readable. A conflict a dispatcher cannot read is a
            // conflict they will override without understanding.
            $table->text('description');
            $table->json('context')->nullable();

            $table->timestamp('detected_at');
            $table->timestamp('resolved_at')->nullable();
            $table->string('resolution', 40)->nullable();
            $table->text('resolution_reason')->nullable();
            $table->unsignedBigInteger('resolved_by')->nullable();

            $table->timestamps();

            $table->index(['company_id', 'status', 'severity'], 'dispatch_conflict_triage_idx');
            $table->index(['assignment_id', 'status'], 'dispatch_conflict_assignment_idx');
            $table->index(['resource_type', 'resource_id'], 'dispatch_conflict_resource_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dispatch_conflicts');
        Schema::dropIfExists('dispatch_resource_allocations');
    }
};
