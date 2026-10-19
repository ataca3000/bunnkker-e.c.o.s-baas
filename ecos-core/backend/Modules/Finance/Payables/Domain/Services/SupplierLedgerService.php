<?php

declare(strict_types=1);

namespace Modules\Finance\Payables\Domain\Services;

use Illuminate\Support\Carbon;
use Modules\Finance\Payables\Domain\Models\SupplierLedgerEntry;

/**
 * The Supplier Ledger read model — the AP mirror of the customer ledger. A
 * running transaction history built from append-only entries; the balance is a
 * cumulative SUM, never stored.
 */
final class SupplierLedgerService
{
    /** The current balance of a supplier — SUM of every entry. Derived. */
    public function balance(string $companyId, string $supplierId): float
    {
        return round((float) SupplierLedgerEntry::query()
            ->where('company_id', $companyId)
            ->where('supplier_id', $supplierId)
            ->sum('amount'), 4);
    }

    /**
     * @return array{supplier_id:string, opening_balance:float, closing_balance:float, lines:list<array<string,mixed>>}
     */
    public function history(string $companyId, string $supplierId, ?Carbon $from = null, ?Carbon $to = null): array
    {
        $opening = $this->openingBalance($companyId, $supplierId, $from);

        $query = SupplierLedgerEntry::query()
            ->where('company_id', $companyId)
            ->where('supplier_id', $supplierId)
            ->orderBy('entry_date')
            ->orderBy('id');

        if ($from !== null) {
            $query->whereDate('entry_date', '>=', $from->toDateString());
        }
        if ($to !== null) {
            $query->whereDate('entry_date', '<=', $to->toDateString());
        }

        $running = $opening;
        $lines = [];

        foreach ($query->get() as $entry) {
            $amount = round((float) $entry->amount, 4);
            $running = round($running + $amount, 4);

            $lines[] = [
                'id' => $entry->id,
                'uuid' => $entry->uuid,
                'entry_date' => $entry->entry_date->toDateString(),
                'entry_type' => $entry->entry_type->value,
                'description' => $entry->description,
                'credit' => $amount > 0 ? $amount : 0.0,
                'debit' => $amount < 0 ? abs($amount) : 0.0,
                'amount' => $amount,
                'running_balance' => $running,
                'journal_entry_id' => $entry->journal_entry_id,
            ];
        }

        return [
            'supplier_id' => $supplierId,
            'opening_balance' => $opening,
            'closing_balance' => $running,
            'lines' => $lines,
        ];
    }

    /** @return array<string, mixed> */
    public function statement(string $companyId, string $supplierId, Carbon $from, Carbon $to): array
    {
        $history = $this->history($companyId, $supplierId, $from, $to);

        return [
            'supplier_id' => $supplierId,
            'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'opening_balance' => $history['opening_balance'],
            'closing_balance' => $history['closing_balance'],
            'movements' => $history['lines'],
        ];
    }

    private function openingBalance(string $companyId, string $supplierId, ?Carbon $from): float
    {
        if ($from === null) {
            return 0.0;
        }

        return round((float) SupplierLedgerEntry::query()
            ->where('company_id', $companyId)
            ->where('supplier_id', $supplierId)
            ->whereDate('entry_date', '<', $from->toDateString())
            ->sum('amount'), 4);
    }
}
