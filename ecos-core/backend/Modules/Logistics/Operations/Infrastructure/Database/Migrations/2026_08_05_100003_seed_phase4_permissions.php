<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Phase 4 permissions — logistics operations.
 *
 * ADDITIVE: every Phase 2 and Phase 3 permission is untouched.
 *
 * Reserving and releasing are separate, for the same reason the ledger itself
 * demands a reason to release a confirmed commitment: giving capacity back is a
 * business decision someone must own, not the undo of a mistake.
 */
return new class extends Migration
{
    private const PERMISSIONS = [
        ['operations.view', 'view', 'View operations dashboards, pools and the exception registry'],
        ['operations.pool.manage', 'pool.manage', 'Create pools and manage their membership'],
        ['operations.capacity.reserve', 'capacity.reserve', 'Request and confirm capacity reservations'],
        ['operations.capacity.release', 'capacity.release', 'Release capacity and rebalance reservations'],
        ['operations.exception.manage', 'exception.manage', 'Acknowledge, annotate and resolve operational exceptions'],
        ['operations.exception.escalate', 'exception.escalate', 'Escalate an exception to a higher level'],
        ['operations.alert.manage', 'alert.manage', 'Create and maintain alert rules'],
        ['operations.audit.view', 'audit.view', 'View the reservation audit trail'],
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
                'resource' => 'operations',
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
