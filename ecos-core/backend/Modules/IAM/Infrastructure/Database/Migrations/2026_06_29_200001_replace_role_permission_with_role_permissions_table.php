<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TASK-SECURITY-001A: Replace the composite-PK `role_permission` pivot with a
 * proper `role_permissions` entity table.
 *
 * Changes from the original pivot:
 *  - UUID surrogate PK (`id`) — makes this a first-class entity
 *  - `created_at` timestamp (assignment audit)
 *  - Nullable architecture columns for future rule engine:
 *      effect      — allow / deny (default allow; no logic yet)
 *      conditions  — JSON rule bag (no logic yet)
 *      expires_at  — time-bounded grants (no logic yet)
 *
 * The extra columns are nullable and carry defaults that preserve current
 * behavior exactly. No business logic reads them today.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('role_permission');

        if (Schema::hasTable('role_permissions')) {
            return;
        }

        Schema::create('role_permissions', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            $table->uuid('role_id');
            $table->uuid('permission_id');

            // Future rule-engine architecture — no logic reads these yet.
            $table->enum('effect', ['allow', 'deny'])->default('allow');
            $table->json('conditions')->nullable();
            $table->timestamp('expires_at')->nullable();

            $table->timestamp('created_at')->nullable();

            $table->foreign('role_id')
                ->references('id')->on('roles')
                ->cascadeOnDelete();

            $table->foreign('permission_id')
                ->references('id')->on('permissions')
                ->cascadeOnDelete();

            $table->unique(['role_id', 'permission_id'], 'role_permissions_role_permission_unique');
            $table->index('role_id');
            $table->index('permission_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('role_permissions');

        Schema::create('role_permission', function (Blueprint $table): void {
            $table->uuid('role_id');
            $table->uuid('permission_id');
            $table->primary(['role_id', 'permission_id']);
            $table->foreign('role_id')->references('id')->on('roles')->cascadeOnDelete();
            $table->foreign('permission_id')->references('id')->on('permissions')->cascadeOnDelete();
        });
    }
};
