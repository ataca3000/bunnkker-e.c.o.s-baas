<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * CRM Customer Foundation — EPIC C1. Customer permissions.
 *
 * Aligns to the already-declared `crm.customers.*` namespace. View/create/update
 * may already exist from the RBAC config seed; merge and archive are new. Seeding
 * is idempotent — an existing permission name is skipped.
 */
return new class extends Migration
{
    private const PERMISSIONS = [
        ['crm.customers.view', 'customers', 'view', 'View customers, profiles and 360°'],
        ['crm.customers.create', 'customers', 'create', 'Create customers'],
        ['crm.customers.update', 'customers', 'update', 'Edit customers, contacts, tags, notes and preferences'],
        ['crm.customers.merge', 'customers', 'merge', 'Merge duplicate customers'],
        ['crm.customers.archive', 'customers', 'archive', 'Archive customers'],
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
                'module' => 'crm',
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

        // Only remove the ones this module introduced (leave shared view/create/update).
        DB::table('permissions')->whereIn('name', ['crm.customers.merge', 'crm.customers.archive'])->delete();
    }
};
