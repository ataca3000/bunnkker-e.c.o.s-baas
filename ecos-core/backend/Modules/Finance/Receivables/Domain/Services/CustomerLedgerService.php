<?php

declare(strict_types=1);

namespace Modules\Finance\Receivables\Domain\Services;

use Illuminate\Support\Carbon;
use Modules\Finance\Receivables\Domain\Models\CustomerLedgerEntry;

/**
 * The Customer Ledger read model — a running transaction history built entirely
 * from the append-only entries. No balance is ever stored: the running balance
 * is a cumulative SUM computed as the history is walked, so it can never drift
 * from the entries it summarises.
 */
final class CustomerLedgerService
{
    /** The current balance of a customer — SUM of every entry. Derived. */
    public function balance(string $companyId, string $customerId): float
    {
        return round((float) CustomerLedgerEntry::query()
            ->where('company_id', $companyId)
            ->where('customer_id', $customerId)
            ->sum('amount'), 4);
    }

    /**
     * The running transaction history for a customer: every entry in order, each
     * with the running balance after it. Optionally bounded to a date window.
     *
     * @return array{customer_id:string, opening_balance:float, closing_balance:float, lines:list<array<string,mixed>>}
     */
    public function history(string $companyId, string $customerId, ?Carbon $from = null, ?Carbon $to = null): array
    {
        $opening = $this->openingBalance($companyId, $customerId, $from);

        $query = CustomerLedgerEntry::query()
            ->where('company_id', $companyId)
            ->where('customer_id', $customerId)
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
                'debit' => $amount > 0 ? $amount : 0.0,
                'credit' => $amount < 0 ? abs($amount) : 0.0,
                'amount' => $amount,
                'running_balance' => $running,
                'journal_entry_id' => $entry->journal_entry_id,
            ];
        }

        return [
            'customer_id' => $customerId,
            'opening_balance' => $opening,
            'closing_balance' => $running,
            'lines' => $lines,
        ];
    }

    /**
     * A customer statement over a period — opening balance, the movements within
     * it, and the closing balance. A view over the same append-only history.
     *
     * @return array<string, mixed>
     */
    public function statement(string $companyId, string $customerId, Carbon $from, Carbon $to): array
    {
        $history = $this->history($companyId, $customerId, $from, $to);

        return [
            'customer_id' => $customerId,
            'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'opening_balance' => $history['opening_balance'],
            'closing_balance' => $history['closing_balance'],
            'movements' => $history['lines'],
        ];
    }

    /** Balance strictly before the window opens — the statement's opening figure. */
    private function openingBalance(string $companyId, string $customerId, ?Carbon $from): float
    {
        if ($from === null) {
            return 0.0;
        }

        return round((float) CustomerLedgerEntry::query()
            ->where('company_id', $companyId)
            ->where('customer_id', $customerId)
            ->whereDate('entry_date', '<', $from->toDateString())
            ->sum('amount'), 4);
    }
}
