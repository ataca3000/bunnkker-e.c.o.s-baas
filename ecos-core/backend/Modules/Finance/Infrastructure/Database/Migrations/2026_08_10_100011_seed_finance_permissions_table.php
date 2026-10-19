<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Finance OS — EPIC F1. Permissions (segregation of duties).
 *
 * The manual-journal lifecycle is split into three DISTINCT permissions —
 * create (maker), approve (checker), post (poster) — so no single person can
 * originate AND commit a journal. Period control and reversal are their own
 * authorities. The Financial Administrator holds the broad admin permission but
 * is still bound by the segregation rules the services enforce.
 */
return new class extends Migration
{
    private const PERMISSIONS = [
        // Read
        ['finance.gl.view', 'gl', 'view', 'View the general ledger and journals'],
        ['finance.trialbalance.view', 'trialbalance', 'view', 'View the trial balance read model'],

        // Master data
        ['finance.coa.manage', 'coa', 'manage', 'Manage the chart of accounts'],
        ['finance.dimension.manage', 'dimension', 'manage', 'Manage financial dimensions (cost centers)'],
        ['finance.tax.manage', 'tax', 'manage', 'Manage tax categories and codes'],
        ['finance.posting.manage', 'posting', 'manage', 'Manage posting rules'],

        // Fiscal calendar
        ['finance.period.manage', 'period', 'manage', 'Open, close and lock fiscal periods'],

        // Journal lifecycle — SEGREGATION OF DUTIES
        ['finance.journal.create', 'journal', 'create', 'Maker: create a manual journal draft'],
        ['finance.journal.approve', 'journal', 'approve', 'Checker: approve a manual journal draft'],
        ['finance.journal.post', 'journal', 'post', 'Poster: post an approved journal to the ledger'],
        ['finance.journal.reverse', 'journal', 'reverse', 'Reverse a posted journal'],

        // Administrator
        ['finance.admin', 'admin', 'manage', 'Financial administrator'],
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
