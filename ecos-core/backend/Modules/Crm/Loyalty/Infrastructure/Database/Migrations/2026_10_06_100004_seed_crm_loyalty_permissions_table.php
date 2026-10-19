<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/** CRM Sales & Loyalty — EPIC C4. Loyalty permissions. */
return new class extends Migration
{
    private const PERMISSIONS = [
        ['crm.loyalty.view', 'loyalty', 'view', 'View loyalty programs, wallets and rewards'],
        ['crm.loyalty.manage', 'loyalty', 'manage', 'Manage programs, tiers, rewards and enrol customers'],
        ['crm.loyalty.transact', 'loyalty', 'transact', 'Earn, redeem and adjust points, and redeem rewards'],
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
