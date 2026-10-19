<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Capacity — the ledger that makes a delivery promise truthful.
 *
 * Capacity is MULTI-DIMENSIONAL: a van full of pillows hits volume long before
 * weight, a van full of tiles hits weight long before order count. Every
 * dimension carries its own available/committed pair and the tightest one
 * decides, because a single "capacity" integer is wrong for half the catalogue.
 *
 * Network ADVISES; Orders decides. Nothing here rejects an order — the same
 * stance BranchAssignmentEngine already takes when there is no coverage.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('network_capacity_plans', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->foreignId('service_area_id')
                ->constrained('network_service_areas')->cascadeOnDelete();
            $table->uuid('company_id')->nullable();

            $table->date('plan_date');
            $table->boolean('is_published')->default(false);
            $table->timestamp('published_at')->nullable();
            $table->unsignedBigInteger('published_by')->nullable();
            $table->text('notes')->nullable();

            $table->timestamps();

            $table->unique(['service_area_id', 'plan_date'], 'network_plan_area_date_unique');
            $table->index(['company_id', 'plan_date'], 'network_plan_company_date_idx');
        });

        Schema::create('network_capacity_slots', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->foreignId('capacity_plan_id')
                ->constrained('network_capacity_plans')->cascadeOnDelete();
            $table->foreignId('service_level_id')->nullable()
                ->constrained('network_service_levels')->nullOnDelete();

            // Null window = the whole day.
            $table->time('window_start')->nullable();
            $table->time('window_end')->nullable();

            $table->unsignedInteger('available_orders')->default(0);
            $table->unsignedInteger('committed_orders')->default(0);
            $table->unsignedInteger('available_stops')->default(0);
            $table->unsignedInteger('committed_stops')->default(0);
            $table->decimal('available_weight_kg', 12, 2)->default(0);
            $table->decimal('committed_weight_kg', 12, 2)->default(0);
            $table->decimal('available_volume_m3', 12, 3)->default(0);
            $table->decimal('committed_volume_m3', 12, 3)->default(0);

            // Fraction of available at which a warning fires (0.85 = 85%).
            $table->decimal('warn_threshold', 4, 3)->default(0.850);

            $table->timestamps();

            // The hot capacity query.
            $table->index(['capacity_plan_id', 'service_level_id'], 'network_slot_plan_level_idx');
        });

        Schema::create('network_capacity_commitments', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->foreignId('capacity_slot_id')
                ->constrained('network_capacity_slots')->cascadeOnDelete();
            $table->uuid('company_id')->nullable();

            $table->string('status', 20)->default('reserved');

            // Whatever the caller is holding capacity for. Free-form by design:
            // Network must not depend on Orders' schema.
            $table->string('reference_type', 40)->nullable();
            $table->string('reference_id', 64)->nullable();

            $table->unsignedInteger('orders')->default(0);
            $table->unsignedInteger('stops')->default(0);
            $table->decimal('weight_kg', 12, 2)->default(0);
            $table->decimal('volume_m3', 12, 3)->default(0);

            // A soft hold MUST expire, or abandoned checkouts silently consume
            // a day's capacity until a zone mysteriously sells out.
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('committed_at')->nullable();
            $table->timestamp('released_at')->nullable();
            $table->text('release_reason')->nullable();

            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->index(['capacity_slot_id', 'status'], 'network_commit_slot_status_idx');
            $table->index(['status', 'expires_at'], 'network_commit_ttl_idx');
            $table->index(['reference_type', 'reference_id'], 'network_commit_ref_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('network_capacity_commitments');
        Schema::dropIfExists('network_capacity_slots');
        Schema::dropIfExists('network_capacity_plans');
    }
};
