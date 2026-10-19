<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Finance OS — EPIC F3. Financial-integration permissions.
 *
 * Configuring how operations becomes accounting is a privileged act, distinct
 * from running the ledger: mapping account roles and editing posting rules are
 * their own authorities, the audit/trace is read-only, and clearing the
 * dead-letter queue (which replays postings) is gated separately.
 */
return new class extends Migration
{
    private const PERMISSIONS = [
        ['finance.posting.rule.manage', 'posting_rule', 'manage', 'Create and edit posting rules'],
        ['finance.integration.map', 'account_role', 'manage', 'Map posting roles to GL accounts'],
        ['finance.posting.preview', 'posting', 'preview', 'Preview the journal a business event would produce'],
        ['finance.posting.audit.view', 'posting_audit', 'view', 'View the posting audit and traceability'],
        ['finance.posting.deadletter.manage', 'posting_deadletter', 'manage', 'Retry or discard dead-lettered postings'],
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
