<?php

declare(strict_types=1);

namespace Modules\Finance\Ledger\Domain\Services;

use Illuminate\Support\Facades\DB;
use Modules\Finance\Ledger\Domain\Enums\JournalStatus;
use Modules\Finance\Ledger\Domain\Enums\NormalBalance;
use Modules\Finance\Ledger\Domain\Models\Account;

/**
 * The Trial Balance — a READ MODEL derived from the journal, never stored.
 *
 * ┌─ NO STORED BALANCES, NO RUNNING TOTALS ─────────────────────────────────┐
 * │ Every figure is aggregated on demand from immutable posted lines. There  │
 * │ is no balance table to drift out of sync with the ledger, because the    │
 * │ ledger IS the balance — summed at read time over indexed columns. The    │
 * │ UI never computes this; it reads this projection.                        │
 * │                                                                          │
 * │ Ready for millions of lines: the sum is filtered by company + period     │
 * │ (indexed) and grouped by account (indexed). A period-partitioned         │
 * │ materialised balance is the sanctioned next-level optimisation           │
 * │ (ADR-F10) — deliberately deferred; the journal stays the source.         │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
class TrialBalanceService
{
    /**
     * @return array<string, mixed>
     */
    public function forPeriod(string $companyId, ?int $fiscalPeriodId = null): array
    {
        // Aggregate posted lines by account. One indexed group-by, no per-row work.
        $rows = DB::table('finance_journal_lines as l')
            ->join('finance_journal_entries as e', 'e.id', '=', 'l.journal_entry_id')
            ->where('l.company_id', $companyId)
            ->whereIn('e.status', [JournalStatus::Posted->value, JournalStatus::Reversed->value])
            ->when($fiscalPeriodId !== null, fn ($q) => $q->where('e.fiscal_period_id', $fiscalPeriodId))
            ->groupBy('l.account_id')
            ->selectRaw('l.account_id, SUM(l.debit) as debit, SUM(l.credit) as credit')
            ->havingRaw('SUM(l.debit) <> 0 OR SUM(l.credit) <> 0')
            ->get();

        $accounts = Account::query()
            ->whereIn('id', $rows->pluck('account_id')->all())
            ->get()
            ->keyBy('id');

        $lines = [];
        $totalDebit = 0.0;
        $totalCredit = 0.0;

        foreach ($rows as $row) {
            $account = $accounts->get($row->account_id);
            if ($account === null) {
                continue;
            }

            $debit = (float) $row->debit;
            $credit = (float) $row->credit;
            $totalDebit += $debit;
            $totalCredit += $credit;

            // Sign the net onto the account's normal side.
            $net = $account->normal_balance === NormalBalance::Debit
                ? $debit - $credit
                : $credit - $debit;

            $lines[] = [
                'account_id' => $account->uuid,
                'account_code' => $account->code,
                'account_name' => $account->name,
                'account_type' => $account->account_type->value,
                'normal_balance' => $account->normal_balance->value,
                'debit' => round($debit, 4),
                'credit' => round($credit, 4),
                'balance' => round($net, 4),
            ];
        }

        usort($lines, static fn ($a, $b) => strcmp($a['account_code'], $b['account_code']));

        return [
            'company_id' => $companyId,
            'fiscal_period_id' => $fiscalPeriodId,
            'lines' => $lines,
            'total_debit' => round($totalDebit, 4),
            'total_credit' => round($totalCredit, 4),
            // The integrity proof: a correct ledger's trial balance always ties.
            'is_balanced' => round($totalDebit, 4) === round($totalCredit, 4),
        ];
    }
}
