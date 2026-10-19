<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * CRM Customer Service — EPIC C3. Service permissions.
 *
 * Segregated authorities: view cases, work them, assign, resolve/close,
 * administer SLA/assignment/escalation, and manage the knowledge base.
 */
return new class extends Migration
{
    private const PERMISSIONS = [
        ['crm.service.view', 'service', 'view', 'View service tickets and case history'],
        ['crm.service.manage', 'service', 'manage', 'Create and work tickets (notes, attachments, transitions)'],
        ['crm.service.assign', 'service', 'assign', 'Assign and reassign tickets'],
        ['crm.service.resolve', 'service', 'resolve', 'Resolve, close and reopen tickets'],
        ['crm.service.admin', 'service', 'admin', 'Manage SLA, assignment and escalation rules'],
        ['crm.kb.view', 'kb', 'view', 'View the knowledge base and resolution library'],
        ['crm.kb.manage', 'kb', 'manage', 'Author knowledge-base articles and resolution templates'],
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

        DB::table('permissions')->whereIn('name', array_column(self::PERMISSIONS, 0))->delete();
    }
};
