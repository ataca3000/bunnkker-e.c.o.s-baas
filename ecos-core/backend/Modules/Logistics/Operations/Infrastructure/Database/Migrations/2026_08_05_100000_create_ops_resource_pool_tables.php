<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Phase 4 — Resource pools.
 *
 * ┌─ THIS CONTEXT OWNS NO RESOURCE FACTS ───────────────────────────────────┐
 * │ A pool is MEMBERSHIP and nothing else. Not a plate number, not a         │
 * │ licence expiry, not a fitness verdict, not a capacity figure. Those are  │
 * │ owned by Vehicles, Drivers, Fleet and Network respectively, and a copy   │
 * │ here would be a second version of the truth that silently goes stale.    │
 * │                                                                          │
 * │ Every read joins outward at query time. That is the cost of one truth.   │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ops_resource_pools', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id')->nullable();

            $table->string('code', 40);
            $table->string('name', 150);
            $table->text('description')->nullable();

            // vehicle | driver | mixed
            $table->string('pool_type', 20)->default('mixed');
            // draft | active | suspended | archived
            $table->string('status', 20)->default('draft');
            $table->text('status_reason')->nullable();

            // A pool may be scoped to where it operates. Both nullable: an
            // unscoped pool is a legitimate "everything" pool.
            $table->foreignId('dispatch_region_id')->nullable()
                ->constrained('network_dispatch_regions')->nullOnDelete();
            $table->foreignId('service_area_id')->nullable()
                ->constrained('network_service_areas')->nullOnDelete();

            // Below this many assignable members the pool is unhealthy. It is a
            // threshold, not a reservation — nothing is held back.
            $table->unsignedSmallInteger('min_assignable')->default(0);

            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'code'], 'ops_pool_company_code_unique');
            $table->index(['company_id', 'status'], 'ops_pool_company_status_idx');
            $table->index(['pool_type', 'status'], 'ops_pool_type_status_idx');
        });

        Schema::create('ops_resource_pool_members', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->foreignId('resource_pool_id')
                ->constrained('ops_resource_pools')->cascadeOnDelete();

            // Polymorphic by intent: vehicle | driver. The id points at the V1
            // table that owns the resource. No attribute travels with it.
            $table->string('member_type', 20);
            $table->unsignedBigInteger('member_id');

            // active | suspended | withdrawn
            $table->string('status', 20)->default('active');
            $table->text('status_reason')->nullable();

            // Why this resource is in this pool at all. Membership without a
            // rationale becomes a list nobody dares prune.
            $table->text('membership_reason')->nullable();

            $table->timestamp('joined_at');
            $table->timestamp('left_at')->nullable();

            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            // A resource belongs to a pool at most once while it is live.
            // Nullable flag inside a plain unique index — the LOG-002 partial
            // unique emulation, since MySQL has no partial indexes.
            $table->unsignedTinyInteger('active_flag')->nullable()->default(1);
            $table->unique(
                ['resource_pool_id', 'member_type', 'member_id', 'active_flag'],
                'ops_pool_member_once_unique',
            );
            $table->index(['member_type', 'member_id'], 'ops_pool_member_resource_idx');
            $table->index(['resource_pool_id', 'status'], 'ops_pool_member_status_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ops_resource_pool_members');
        Schema::dropIfExists('ops_resource_pools');
    }
};
