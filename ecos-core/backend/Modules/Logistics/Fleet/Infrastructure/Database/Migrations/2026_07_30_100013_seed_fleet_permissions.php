<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Registers the Fleet permission set in the IAM catalogue.
 *
 * The perform/approve and record/reconcile splits are separation of duties, not
 * ceremony: evidence should not be self-certified, and the person entering a
 * fuel purchase should not clear their own anomaly.
 *
 * Idempotent — keyed on the unique permission name. No role is granted anything
 * here; assignment stays an operator decision.
 */
return new class extends Migration
{
    private const PERMISSIONS = [
        ['fleet.view', 'view', 'View fleet units, health and maintenance'],
        ['fleet.manage', 'manage', 'Create and manage fleets, groups and units'],
        ['fleet.maintenance.schedule', 'maintenance.schedule', 'Plan and schedule maintenance work'],
        ['fleet.maintenance.complete', 'maintenance.complete', 'Complete maintenance work orders'],
        ['fleet.inspection.perform', 'inspection.perform', 'Perform and submit vehicle inspections'],
        ['fleet.inspection.approve', 'inspection.approve', 'Approve or reject submitted inspections'],
        ['fleet.fuel.record', 'fuel.record', 'Record fuel transactions and odometer readings'],
        ['fleet.fuel.reconcile', 'fuel.reconcile', 'Reconcile, dispute or write off fuel transactions'],
        ['fleet.cost.view', 'cost.view', 'View vehicle operational cost'],
        ['fleet.health.override', 'health.override', 'Override a fitness verdict or dismiss a critical defect'],
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
                'resource' => 'fleet',
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
