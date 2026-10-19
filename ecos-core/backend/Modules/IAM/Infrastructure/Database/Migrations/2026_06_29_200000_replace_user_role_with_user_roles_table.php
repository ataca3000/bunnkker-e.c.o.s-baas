<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TASK-SECURITY-001A: Replace the composite-PK `user_role` pivot with a proper
 * `user_roles` entity table.
 *
 * Changes from the original pivot:
 *  - UUID surrogate PK (`id`) — makes this a first-class entity
 *  - Scope columns (company_id, branch_id, warehouse_id) for future scoped RBAC
 *  - Timestamps (created_at, updated_at)
 *  - Unique constraint on (user_id, role_id) for the current global-scope phase;
 *    this will be replaced with a full-scope unique index when scoped auth lands.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('user_role');

        if (Schema::hasTable('user_roles')) {
            return;
        }

        Schema::create('user_roles', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            $table->unsignedBigInteger('user_id');
            $table->uuid('role_id');

            // Scope columns — nullable until scoped authorization is implemented.
            $table->uuid('company_id')->nullable();
            $table->uuid('branch_id')->nullable();
            $table->uuid('warehouse_id')->nullable();

            $table->timestamps();

            $table->foreign('user_id')
                ->references('id')->on('users')
                ->cascadeOnDelete();

            $table->foreign('role_id')
                ->references('id')->on('roles')
                ->cascadeOnDelete();

            // Phase-1 uniqueness: one global role assignment per user.
            // Replace with scope-aware unique index when Company/Branch/Warehouse
            // scoped authorization is implemented.
            $table->unique(['user_id', 'role_id'], 'user_roles_user_role_unique');

            $table->index('user_id');
            $table->index('role_id');
            $table->index('company_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_roles');

        Schema::create('user_role', function (Blueprint $table): void {
            $table->unsignedBigInteger('user_id');
            $table->uuid('role_id');
            $table->primary(['user_id', 'role_id']);
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('role_id')->references('id')->on('roles')->cascadeOnDelete();
            $table->index('user_id');
            $table->index('role_id');
        });
    }
};
