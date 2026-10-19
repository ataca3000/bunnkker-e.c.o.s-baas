<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * CRM Executive Workspace — EPIC C6. Permissions.
 *
 * ┌─ THE ONLY MIGRATION THIS MODULE HAS ────────────────────────────────────┐
 * │ The executive workspace creates NO tables. It owns no data — every number   │
 * │ it shows is derived on read from the CRM's existing tables. All this        │
 * │ migration does is register who is allowed to look.                         │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
return new class extends Migration
{
    private const PERMISSIONS = [
        ['crm.executive.view', 'executive', 'view', 'View the executive CRM dashboard and KPIs'],
        ['crm.executive.report', 'executive', 'report', 'Generate monthly, quarterly and annual executive reports'],
        ['crm.executive.export', 'executive', 'export', 'Export executive reports'],
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
                'name' => $name, 'module' => 'crm', 'resource' => $resource,
                'action' => $action, 'description' => $description,
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('permissions')) {
            return;
        }

        DB::table('permissions')->whereIn('name', array_column(self::PERMISSIONS, 0))->delete();
    }
};
