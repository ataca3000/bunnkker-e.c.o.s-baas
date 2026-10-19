<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Routing — sequence and path.
 *
 * ┌─ DIRECTIVE 10 — STRATEGY PATTERN ───────────────────────────────────────┐
 * │ routing_optimization_runs stores the full INPUT SNAPSHOT alongside the   │
 * │ strategy name and version. That single decision is what makes a run      │
 * │ replayable, a regression debuggable, and a future AI strategy a drop-in  │
 * │ rather than a redesign — it is a growing corpus of                       │
 * │ (problem, chosen solution) pairs from day one, at negligible cost.       │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Plans SUPERSEDE, never update. A reroute writes a new plan and the old one
 * stays readable, which is what makes "why did we drive that way?" answerable.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('routing_route_plans', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id')->nullable();

            // Distribution owns the trip. Referenced, never written.
            $table->unsignedBigInteger('trip_id');
            $table->foreign('trip_id')->references('id')->on('distribution_trips')->cascadeOnDelete();

            $table->string('status', 20)->default('draft');
            $table->string('strategy', 60)->nullable();
            $table->string('strategy_version', 20)->nullable();

            $table->decimal('total_distance_km', 12, 2)->nullable();
            $table->unsignedInteger('total_duration_minutes')->nullable();
            $table->unsignedSmallInteger('stop_count')->default(0);
            $table->decimal('confidence', 4, 3)->nullable();

            // Self-referencing supersession chain.
            $table->unsignedBigInteger('superseded_by_plan_id')->nullable();
            $table->text('supersede_reason')->nullable();

            $table->timestamp('planned_at')->nullable();
            $table->timestamp('activated_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();

            $table->timestamps();

            $table->foreign('superseded_by_plan_id')
                ->references('id')->on('routing_route_plans')->nullOnDelete();

            // Current-plan lookup: the one row per trip with no successor.
            $table->index(['trip_id', 'superseded_by_plan_id'], 'routing_plan_current_idx');
            $table->index(['company_id', 'status'], 'routing_plan_company_status_idx');
        });

        Schema::create('routing_route_stop_refs', function (Blueprint $table): void {
            $table->id();

            $table->foreignId('route_plan_id')
                ->constrained('routing_route_plans')->cascadeOnDelete();

            // Points AT Distribution's stop. Address, customer and order stay
            // in V1 — nothing is copied here.
            $table->unsignedBigInteger('stop_id');
            $table->foreign('stop_id')
                ->references('id')->on('distribution_delivery_stops')->cascadeOnDelete();

            $table->unsignedSmallInteger('sequence');

            // A stop that has already been attempted is FROZEN: a reroute may
            // re-plan only the remainder, never rewrite history.
            $table->boolean('is_frozen')->default(false);

            $table->timestamps();

            $table->unique(['route_plan_id', 'stop_id'], 'routing_stop_ref_unique');
            $table->index(['route_plan_id', 'sequence'], 'routing_stop_ref_order_idx');
            $table->index('stop_id', 'routing_stop_ref_reverse_idx');
        });

        Schema::create('routing_route_legs', function (Blueprint $table): void {
            $table->id();

            $table->foreignId('route_plan_id')
                ->constrained('routing_route_plans')->cascadeOnDelete();

            $table->unsignedSmallInteger('sequence');
            $table->foreignId('from_stop_ref_id')->nullable()
                ->constrained('routing_route_stop_refs')->nullOnDelete();
            $table->foreignId('to_stop_ref_id')->nullable()
                ->constrained('routing_route_stop_refs')->nullOnDelete();

            // Null from_stop_ref = the leg out of the origin depot.
            $table->decimal('origin_lat', 10, 7)->nullable();
            $table->decimal('origin_lng', 10, 7)->nullable();

            $table->decimal('distance_km', 10, 2)->default(0);
            $table->unsignedInteger('duration_minutes')->default(0);

            $table->timestamps();

            $table->index(['route_plan_id', 'sequence'], 'routing_leg_order_idx');
        });

        Schema::create('routing_eta_projections', function (Blueprint $table): void {
            $table->id();

            $table->foreignId('stop_ref_id')
                ->constrained('routing_route_stop_refs')->cascadeOnDelete();

            // L0 planned · L1 departure-adjusted · L2 progress-adjusted.
            // L3 (position-adjusted) needs Telemetry, deferred to Phase 8 (D3),
            // so nothing here depends on it.
            $table->unsignedTinyInteger('refinement_level')->default(0);
            $table->timestamp('projected_arrival_at');
            $table->unsignedSmallInteger('service_minutes')->default(0);
            $table->boolean('breach_predicted')->default(false);
            $table->integer('minutes_late')->nullable();

            $table->timestamps();

            $table->index(['stop_ref_id', 'refinement_level'], 'routing_eta_latest_idx');
        });

        Schema::create('routing_optimization_runs', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->foreignId('route_plan_id')->nullable()
                ->constrained('routing_route_plans')->nullOnDelete();
            $table->uuid('company_id')->nullable();

            $table->string('strategy', 60);
            $table->string('strategy_version', 20)->nullable();
            $table->boolean('succeeded')->default(true);
            $table->text('failure_reason')->nullable();

            // The replay harness and, later, the AI training corpus.
            $table->json('request_snapshot')->nullable();
            $table->json('proposal_summary')->nullable();
            $table->json('constraint_violations')->nullable();

            $table->unsignedInteger('duration_ms')->nullable();
            $table->unsignedSmallInteger('stop_count')->default(0);
            $table->unsignedBigInteger('created_by')->nullable();

            $table->timestamps();

            $table->index(['company_id', 'created_at'], 'routing_run_company_time_idx');
            $table->index(['strategy', 'succeeded'], 'routing_run_strategy_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('routing_optimization_runs');
        Schema::dropIfExists('routing_eta_projections');
        Schema::dropIfExists('routing_route_legs');
        Schema::dropIfExists('routing_route_stop_refs');
        Schema::dropIfExists('routing_route_plans');
    }
};
