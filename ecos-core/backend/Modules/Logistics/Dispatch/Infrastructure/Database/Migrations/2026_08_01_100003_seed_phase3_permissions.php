<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Phase 3 permissions — dispatch operations.
 *
 * ADDITIVE: the four Phase 2 dispatch permissions are untouched. These extend
 * the set for session control, review/approval, conflict resolution and
 * monitoring.
 *
 * The review/approve split follows the same separation-of-duties principle as
 * LOG-005's POD capture vs. validate: a decision carrying risk should not be
 * self-certified.
 */
return new class extends Migration
{
    private const PERMISSIONS = [
        ['dispatch.session.manage', 'session.manage', 'Open, pause and close dispatch sessions'],
        ['dispatch.queue.manage', 'queue.manage', 'Reorder, prioritise and defer queue items'],
        ['dispatch.assignment.review', 'assignment.review', 'Request and record assignment reviews'],
        ['dispatch.assignment.approve', 'assignment.approve', 'Approve or reject an assignment under review'],
        ['dispatch.assignment.override', 'assignment.override', 'Override a blocked assignment with a recorded reason'],
        ['dispatch.conflict.resolve', 'conflict.resolve', 'Resolve resource conflicts'],
        ['dispatch.audit.view', 'audit.view', 'View the dispatch audit trail'],
        ['dispatch.monitoring.view', 'monitoring.view', 'View dispatch KPIs, queue statistics and exceptions'],
    ];

    public function up(): void
    {
        if (! Schema::hasTable('permissions')) {
            return;
        }

        foreach (self::PERMISSIONS as [$name, $action, $description]) {
            if (DB::table('permissions')->where('name', $name)->exists()) {
                continue;
            }

            DB::table('permissions')->insert([
                'id' => (string) Str::uuid(),
                'name' => $name,
                'module' => 'logistics',
                'resource' => 'dispatch',
                'action' => $action,
                'description' => $description,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('permissions')) {
            return;
        }

        DB::table('permissions')
            ->whereIn('name', array_column(self::PERMISSIONS, 0))
            ->delete();
    }
};
