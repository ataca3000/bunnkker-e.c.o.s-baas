<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Finance OS — EPIC F2. Subledger permissions (segregation of duties).
 *
 * AR, AP, cash, banking, reconciliation and allocation each carry their own
 * authorities. Where a document commits money out of the business (supplier
 * payments) the approve authority is split from create so the maker cannot also
 * release the payment. Reconciliation completion is its own authority.
 */
return new class extends Migration
{
    private const PERMISSIONS = [
        // Accounts Receivable
        ['finance.ar.view', 'ar', 'view', 'View customer invoices, receipts and ledger'],
        ['finance.ar.invoice.create', 'ar', 'create', 'Create customer invoices / credit / debit notes'],
        ['finance.ar.invoice.post', 'ar', 'post', 'Post a customer invoice to the ledger'],
        ['finance.ar.receipt.create', 'ar', 'create', 'Record a customer receipt'],
        ['finance.ar.writeoff', 'ar', 'writeoff', 'Write off an uncollectable receivable'],

        // Accounts Payable
        ['finance.ap.view', 'ap', 'view', 'View supplier bills, payments and ledger'],
        ['finance.ap.bill.create', 'ap', 'create', 'Create supplier bills / credit / debit notes'],
        ['finance.ap.bill.post', 'ap', 'post', 'Post a supplier bill to the ledger'],
        ['finance.ap.payment.create', 'ap', 'create', 'Maker: create a supplier payment'],
        ['finance.ap.payment.approve', 'ap', 'approve', 'Checker: approve and release a supplier payment'],

        // Allocation
        ['finance.allocation.manage', 'allocation', 'manage', 'Allocate receipts and payments to documents'],

        // Cash
        ['finance.cash.view', 'cash', 'view', 'View cash accounts, sessions and transactions'],
        ['finance.cash.manage', 'cash', 'manage', 'Post cash transactions, transfers and adjustments'],
        ['finance.cash.session.manage', 'cash', 'session', 'Open and close cash sessions'],

        // Banking
        ['finance.bank.view', 'bank', 'view', 'View bank accounts and statements'],
        ['finance.bank.manage', 'bank', 'manage', 'Manage bank accounts and import statements'],
        ['finance.bank.reconcile', 'bank', 'reconcile', 'Match statement lines and complete reconciliations'],
        ['finance.bank.rule.manage', 'bank', 'rule', 'Manage automatic reconciliation rules'],
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
