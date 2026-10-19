<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Finance OS — EPIC F4. Financial-control permissions (maker/checker).
 *
 * Closing and year-end split the doer from the approver; budgeting splits author
 * from approver; controls and the closing workspace are read-only authorities.
 */
return new class extends Migration
{
    private const PERMISSIONS = [
        // Period management
        ['finance.period.close', 'period', 'close', 'Soft/hard close a fiscal period'],
        ['finance.period.reopen', 'period', 'reopen', 'Reopen a closed period (authorized)'],

        // Closing workflow
        ['finance.closing.manage', 'closing', 'manage', 'Run and validate a closing'],
        ['finance.closing.approve', 'closing', 'approve', 'Approve and finalize a closing (checker)'],

        // Year-end
        ['finance.yearend.manage', 'yearend', 'manage', 'Run year-end closing'],
        ['finance.yearend.finalize', 'yearend', 'finalize', 'Finalize year-end (immutable, checker)'],

        // Budgeting
        ['finance.budget.view', 'budget', 'view', 'View budgets and budget-vs-actual'],
        ['finance.budget.manage', 'budget', 'manage', 'Author budgets, versions and lines'],
        ['finance.budget.approve', 'budget', 'approve', 'Approve a budget (checker)'],
        ['finance.budget.control', 'budget_control', 'manage', 'Manage budget control rules and commitments'],

        // VAT
        ['finance.vat.view', 'vat', 'view', 'View VAT periods, returns and reports'],
        ['finance.vat.manage', 'vat', 'manage', 'Generate returns and settle VAT periods'],

        // Controls & workspace
        ['finance.controls.view', 'controls', 'view', 'Run financial controls and view exceptions'],
        ['finance.controls.resolve', 'controls', 'resolve', 'Acknowledge/resolve control exceptions'],
        ['finance.closing.workspace.view', 'closing_workspace', 'view', 'View the closing workspace dashboard'],
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
