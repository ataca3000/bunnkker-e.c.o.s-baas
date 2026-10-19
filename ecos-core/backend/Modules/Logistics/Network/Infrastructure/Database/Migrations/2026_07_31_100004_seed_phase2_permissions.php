<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Phase 2 permission set — Network, Dispatch, Routing and Carriers.
 *
 * Seeded from one migration because the four contexts ship together; splitting
 * them would add three migrations that always run in lockstep.
 *
 * The propose/release split is separation of duties: an automated proposal must
 * not be able to commit itself to V1.
 *
 * Idempotent, keyed on the unique permission name. No role is granted anything.
 */
return new class extends Migration
{
    private const PERMISSIONS = [
        // Network
        ['network.view', 'network', 'view', 'View service areas, coverage and capacity'],
        ['network.manage', 'network', 'manage', 'Create and manage service areas, regions and levels'],
        ['network.capacity.manage', 'network', 'capacity.manage', 'Publish and adjust capacity plans'],
        ['network.capacity.commit', 'network', 'capacity.commit', 'Reserve, commit and release capacity'],

        // Dispatch
        ['dispatch.view', 'dispatch', 'view', 'View dispatch boards and proposals'],
        ['dispatch.propose', 'dispatch', 'propose', 'Generate and adjust dispatch proposals'],
        ['dispatch.release', 'dispatch', 'release', 'Release a proposal, committing resources in V1'],
        ['dispatch.manage', 'dispatch', 'manage', 'Open, close and configure dispatch boards'],

        // Routing
        ['routing.view', 'routing', 'view', 'View route plans and ETAs'],
        ['routing.optimize', 'routing', 'optimize', 'Plan and re-plan routes'],
        ['routing.manage', 'routing', 'manage', 'Configure routing strategy policy'],

        // Carriers
        ['carrier.view', 'carrier', 'view', 'View carrier accounts and capabilities'],
        ['carrier.manage', 'carrier', 'manage', 'Configure carrier accounts and status mappings'],
    ];

    public function up(): void
    {
        if (! Schema::hasTable('permissions')) {
            return;
        }

        foreach (self::PERMISSIONS as [$name, $resource, $action, $description]) {
            if (DB::table('permissions')->where('name', $name)->exists()) {
                continue;
            }

            DB::table('permissions')->insert([
                'id' => (string) Str::uuid(),
                'name' => $name,
                'module' => 'logistics',
                'resource' => $resource,
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
