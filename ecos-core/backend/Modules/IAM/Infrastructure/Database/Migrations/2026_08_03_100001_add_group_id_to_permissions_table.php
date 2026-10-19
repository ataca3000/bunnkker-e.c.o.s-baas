<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TASK-IAM-002 Phase 1 — link permissions to a group (ADR-038, Part 3).
 *
 * Additive and NULLABLE: adds an optional `group_id` FK to `permissions`. Every
 * existing row keeps group_id = NULL, so nothing is grouped and no resolution,
 * seeding, middleware, or policy behaviour changes. Grouping existing permissions
 * is deferred to a later phase.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('permissions') || Schema::hasColumn('permissions', 'group_id')) {
            return;
        }

        Schema::table('permissions', function (Blueprint $table): void {
            $table->uuid('group_id')->nullable()->after('resource');

            $table->foreign('group_id')
                ->references('id')
                ->on('permission_groups')
                ->nullOnDelete();

            $table->index('group_id');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('permissions') || ! Schema::hasColumn('permissions', 'group_id')) {
            return;
        }

        Schema::table('permissions', function (Blueprint $table): void {
            $table->dropForeign(['group_id']);
            $table->dropIndex(['group_id']);
            $table->dropColumn('group_id');
        });
    }
};
