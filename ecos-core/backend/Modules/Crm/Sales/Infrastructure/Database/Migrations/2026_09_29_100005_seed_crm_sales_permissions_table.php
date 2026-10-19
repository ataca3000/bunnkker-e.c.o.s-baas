<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/** CRM Sales & Loyalty — EPIC C4. Sales permissions. */
return new class extends Migration
{
    private const PERMISSIONS = [
        ['crm.sales.view', 'sales', 'view', 'View leads, opportunities, pipeline and quotes'],
        ['crm.sales.manage', 'sales', 'manage', 'Manage leads, opportunities, quotes and activities'],
        ['crm.sales.convert', 'sales', 'convert', 'Convert leads and win/lose opportunities'],
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
