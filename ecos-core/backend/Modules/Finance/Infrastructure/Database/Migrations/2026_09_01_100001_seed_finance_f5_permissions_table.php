<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Finance OS — EPIC F5. Executive intelligence permissions (READ-ONLY).
 *
 * This Epic is entirely read-driven, so every permission is a view authority.
 * There are no create/update/approve permissions here.
 */
return new class extends Migration
{
    private const PERMISSIONS = [
        ['finance.executive.workspace.view', 'executive_workspace', 'view', 'View the executive financial workspace'],
        ['finance.cfo.workspace.view', 'cfo_workspace', 'view', 'View the CFO workspace'],
        ['finance.analytics.view', 'analytics', 'view', 'View financial analytics, intelligence and dashboards'],
        ['finance.reports.view', 'reports', 'view', 'View and generate executive reports'],
        ['finance.scenario.view', 'scenario', 'view', 'Run read-only scenario analysis'],
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
                'module' => 'finance',
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
