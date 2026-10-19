<?php

declare(strict_types=1);

namespace Modules\Finance\Closing\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Finance\Closing\Domain\Enums\YearEndStatus;
use Modules\Finance\Closing\Domain\Models\YearEndClosing;
use Modules\Finance\Fiscal\Domain\Models\FiscalPeriod;
use Modules\Finance\Fiscal\Domain\Models\FiscalYear;
use Modules\Finance\Ledger\Domain\Enums\JournalStatus;
use Modules\Finance\Ledger\Domain\Enums\JournalType;
use Modules\Finance\Ledger\Domain\Enums\NormalBalance;
use Modules\Finance\Ledger\Domain\Exceptions\FinanceException;
use Modules\Finance\Ledger\Domain\Models\Account;
use Modules\Finance\Ledger\Domain\Models\JournalEntry;
use Modules\Finance\Ledger\Domain\Services\JournalEngine;
use Modules\Finance\Ledger\Domain\ValueObjects\PostingLine;
use Modules\Finance\Ledger\Domain\ValueObjects\PostingRequest;
use Modules\Finance\Posting\Domain\Services\PostingCoordinator;

/**
 * Year-End Closing — P&L closing, retained earnings, opening-balance carry
 * forward, multi-year.
 *
 * ┌─ REPEATABLE, NEVER MUTATES HISTORY ─────────────────────────────────────┐
 * │ Closing sweeps every revenue and expense account to retained earnings and  │
 * │ carries balance-sheet balances forward as next year's opening entry. It     │
 * │ posts ONLY through the Posting Engine and never edits a historical journal: │
 * │ a re-run REVERSES the prior run's journals (a mirror entry) and posts        │
 * │ fresh ones, so it is safely repeatable until finalized — after which it is  │
 * │ immutable.                                                                  │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class YearEndClosingService
{
    private const SOURCE_MODULE = 'finance.yearend';

    public function __construct(
        private readonly PostingCoordinator $coordinator,
        private readonly JournalEngine $engine,
    ) {}

    /**
     * Close (or re-close) the year: sweep P&L to retained earnings and generate
     * next year's opening balances. Repeatable until finalized.
     */
    public function close(
        FiscalYear $year,
        int $retainedEarningsAccountId,
        ?FiscalYear $nextYear = null,
        ?int $actorId = null,
    ): YearEndClosing {
        $closing = YearEndClosing::query()->firstOrNew([
            'company_id' => $year->company_id,
            'fiscal_year_id' => $year->id,
        ]);

        if ($closing->exists && $closing->isFinalized()) {
            throw FinanceException::yearEndFinalized();
        }

        return DB::transaction(function () use ($closing, $year, $retainedEarningsAccountId, $nextYear, $actorId): YearEndClosing {
            // Repeatable: undo the prior run before posting a fresh one.
            $this->reversePriorRun($closing, $actorId);

            $runNo = (int) $closing->run_count + 1;
            $lastPeriod = $this->lastPeriod($year);

            // 1. Close P&L to retained earnings.
            [$pnlJournal, $netIncome] = $this->postPnlClosing($year, $lastPeriod, $retainedEarningsAccountId, $runNo, $actorId);

            // 2. Close the books: zero the balance sheet at year end and reinstate
            //    it as next year's opening entry. The pair keeps the continuous
            //    ledger's cumulative balances correct (no double-count).
            $carryForwardJournal = null;
            $openingJournal = null;
            if ($nextYear !== null) {
                [$carryForwardJournal, $openingJournal] = $this->postCarryForward($year, $nextYear, $runNo, $actorId);
            }

            $closing->fill([
                'company_id' => $year->company_id,
                'fiscal_year_id' => $year->id,
                'next_fiscal_year_id' => $nextYear?->id,
                'status' => YearEndStatus::Closed->value,
                'retained_earnings_account_id' => $retainedEarningsAccountId,
                'net_income' => $netIncome,
                'pnl_closing_journal_id' => $pnlJournal->id,
                'carry_forward_journal_id' => $carryForwardJournal?->id,
                'opening_journal_id' => $openingJournal?->id,
                'run_count' => $runNo,
                'closed_by' => $actorId,
                'closed_at' => Carbon::now(),
            ])->save();

            return $closing->refresh();
        });
    }

    /** Finalize — freeze the year-end. No further runs; the record is immutable. */
    public function finalize(YearEndClosing $closing, int $actorId): YearEndClosing
    {
        if ($closing->isFinalized()) {
            throw FinanceException::yearEndFinalized();
        }
        if ($closing->status !== YearEndStatus::Closed) {
            throw new FinanceException('Only a closed year-end can be finalized.');
        }

        $closing->update([
            'status' => YearEndStatus::Finalized->value,
            'finalized_by' => $actorId,
            'finalized_at' => Carbon::now(),
        ]);

        return $closing->refresh();
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    private function reversePriorRun(YearEndClosing $closing, ?int $actorId): void
    {
        foreach (['pnl_closing_journal_id', 'carry_forward_journal_id', 'opening_journal_id'] as $field) {
            $id = $closing->{$field};
            if ($id === null) {
                continue;
            }
            $journal = JournalEntry::query()->find($id);
            if ($journal !== null && $journal->status === JournalStatus::Posted) {
                $this->engine->reverse($journal, 'Year-end re-run', $actorId);
            }
        }
    }

    /** @return array{0: JournalEntry, 1: float} */
    private function postPnlClosing(FiscalYear $year, FiscalPeriod $period, int $reAccountId, int $runNo, ?int $actorId): array
    {
        $periodIds = $this->periodIds($year);
        $lines = [];
        $revenueTotal = 0.0;
        $expenseTotal = 0.0;

        foreach ($this->pnlAccounts($year->company_id) as $account) {
            $balance = $this->activityBalance($year->company_id, (int) $account->id, $account->normal_balance, $periodIds);
            if (abs($balance) < 0.00005) {
                continue;
            }

            // Zero the account by posting the OPPOSITE of its normal-side balance.
            $lines[] = $this->closingLine((int) $account->id, $balance, $account->normal_balance, $year->company_id);

            if ($account->normal_balance === NormalBalance::Credit) {
                $revenueTotal += $balance;   // income (credit-normal)
            } else {
                $expenseTotal += $balance;   // cost (debit-normal)
            }
        }

        $netIncome = round($revenueTotal - $expenseTotal, 4);

        // The balancing leg to retained earnings.
        if ($netIncome > 0.0) {
            $lines[] = PostingLine::credit($reAccountId, $netIncome, $year->company_id);
        } elseif ($netIncome < 0.0) {
            $lines[] = PostingLine::debit($reAccountId, abs($netIncome), $year->company_id);
        }

        if (count($lines) < 2) {
            throw new FinanceException('There is no profit or loss to close for this year.');
        }

        $request = new PostingRequest(
            companyId: $year->company_id,
            entryDate: Carbon::parse($period->end_date),
            lines: $lines,
            reference: 'YEC-'.$year->name,
            description: 'Year-end P&L closing '.$year->name,
            source: 'posting',
            sourceModule: self::SOURCE_MODULE,
            sourceEventId: 'pnl:'.$year->uuid.':run'.$runNo,
            journalType: JournalType::Adjustment->value,
        );

        $journal = $this->coordinator->post(self::SOURCE_MODULE, 'pnl:'.$year->uuid.':run'.$runNo, $request, null, $actorId);

        return [$journal, $netIncome];
    }

    /**
     * Close the books: zero the balance-sheet accounts at year end (carry-forward
     * journal) and reinstate them as next year's opening entry. Both are built
     * from the SAME year-end balances, captured once (after the P&L close).
     *
     * @return array{0: ?JournalEntry, 1: ?JournalEntry}
     */
    private function postCarryForward(FiscalYear $year, FiscalYear $nextYear, int $runNo, ?int $actorId): array
    {
        $openingPeriod = FiscalPeriod::query()
            ->where('fiscal_year_id', $nextYear->id)
            ->orderBy('period_number')
            ->first();

        if ($openingPeriod === null) {
            throw FinanceException::nextYearMissing();
        }

        $lastPeriod = $this->lastPeriod($year);

        // Capture year-end balances once (they include the P&L close just posted).
        $balances = [];
        foreach ($this->balanceSheetAccounts($year->company_id) as $account) {
            $balance = $this->cumulativeBalance($year->company_id, (int) $account->id, Carbon::parse($year->end_date), $account->normal_balance);
            if (abs($balance) >= 0.00005) {
                $balances[] = ['id' => (int) $account->id, 'net' => $balance, 'normal' => $account->normal_balance];
            }
        }

        if (count($balances) < 2) {
            return [null, null];
        }

        // Carry-forward OUT — zero the balance sheet on the year's last day.
        $closeLines = array_map(fn ($b) => $this->closingLine($b['id'], $b['net'], $b['normal'], $year->company_id), $balances);
        $carryForward = $this->coordinator->post(self::SOURCE_MODULE, 'carryfwd:'.$year->uuid.':run'.$runNo, new PostingRequest(
            companyId: $year->company_id,
            entryDate: Carbon::parse($lastPeriod->end_date),
            lines: $closeLines,
            reference: 'CFWD-'.$year->name,
            description: 'Balance-sheet carry-forward '.$year->name,
            source: 'posting',
            sourceModule: self::SOURCE_MODULE,
            sourceEventId: 'carryfwd:'.$year->uuid.':run'.$runNo,
            journalType: JournalType::Adjustment->value,
        ), null, $actorId);

        // Opening — reinstate the balance sheet on the new year's first day.
        $openLines = array_map(fn ($b) => $this->openingLine($b['id'], $b['net'], $b['normal'], $year->company_id), $balances);
        $opening = $this->coordinator->post(self::SOURCE_MODULE, 'opening:'.$year->uuid.':run'.$runNo, new PostingRequest(
            companyId: $year->company_id,
            entryDate: Carbon::parse($openingPeriod->start_date),
            lines: $openLines,
            reference: 'OPEN-'.$nextYear->name,
            description: 'Opening balances '.$nextYear->name,
            source: 'posting',
            sourceModule: self::SOURCE_MODULE,
            sourceEventId: 'opening:'.$year->uuid.':run'.$runNo,
            journalType: JournalType::Opening->value,
        ), null, $actorId);

        return [$carryForward, $opening];
    }

    /** @return \Illuminate\Support\Collection<int, Account> */
    private function pnlAccounts(string $companyId)
    {
        return Account::query()
            ->where('company_id', $companyId)
            ->whereIn('account_type', ['revenue', 'expense'])
            ->where('is_postable', true)
            ->get();
    }

    /** @return \Illuminate\Support\Collection<int, Account> */
    private function balanceSheetAccounts(string $companyId)
    {
        return Account::query()
            ->where('company_id', $companyId)
            ->whereIn('account_type', ['asset', 'liability', 'equity'])
            ->where('is_postable', true)
            ->get();
    }

    /** Activity within the year's periods, signed onto the account's normal side. */
    private function activityBalance(string $companyId, int $accountId, NormalBalance $normal, array $periodIds): float
    {
        if ($periodIds === []) {
            return 0.0;
        }

        $row = DB::table('finance_journal_lines as l')
            ->join('finance_journal_entries as e', 'e.id', '=', 'l.journal_entry_id')
            ->where('l.account_id', $accountId)
            ->whereIn('e.status', [JournalStatus::Posted->value, JournalStatus::Reversed->value])
            ->whereIn('e.fiscal_period_id', $periodIds)
            ->selectRaw('COALESCE(SUM(l.debit),0) as debit, COALESCE(SUM(l.credit),0) as credit')
            ->first();

        $debit = (float) ($row->debit ?? 0);
        $credit = (float) ($row->credit ?? 0);

        return round($normal === NormalBalance::Debit ? $debit - $credit : $credit - $debit, 4);
    }

    /** Cumulative balance up to a date, signed onto the account's normal side. */
    private function cumulativeBalance(string $companyId, int $accountId, Carbon $asOf, NormalBalance $normal): float
    {
        $row = DB::table('finance_journal_lines as l')
            ->join('finance_journal_entries as e', 'e.id', '=', 'l.journal_entry_id')
            ->where('l.account_id', $accountId)
            ->whereIn('e.status', [JournalStatus::Posted->value, JournalStatus::Reversed->value])
            ->whereDate('e.entry_date', '<=', $asOf->toDateString())
            ->selectRaw('COALESCE(SUM(l.debit),0) as debit, COALESCE(SUM(l.credit),0) as credit')
            ->first();

        $debit = (float) ($row->debit ?? 0);
        $credit = (float) ($row->credit ?? 0);

        return round($normal === NormalBalance::Debit ? $debit - $credit : $credit - $debit, 4);
    }

    /** A line that ZEROES an account holding $net on its normal side (opposite side). */
    private function closingLine(int $accountId, float $net, NormalBalance $normal, string $companyId): PostingLine
    {
        $onNormalSide = $normal === NormalBalance::Debit;
        // To zero: post opposite of the normal side for a positive net.
        $debit = $onNormalSide ? ($net < 0) : ($net >= 0);

        return $debit
            ? PostingLine::debit($accountId, abs($net), $companyId)
            : PostingLine::credit($accountId, abs($net), $companyId);
    }

    /** A line that REINSTATES an account's $net on its normal side (same side). */
    private function openingLine(int $accountId, float $net, NormalBalance $normal, string $companyId): PostingLine
    {
        $onNormalSide = $normal === NormalBalance::Debit;
        $debit = $onNormalSide ? ($net >= 0) : ($net < 0);

        return $debit
            ? PostingLine::debit($accountId, abs($net), $companyId)
            : PostingLine::credit($accountId, abs($net), $companyId);
    }

    /** @return list<int> */
    private function periodIds(FiscalYear $year): array
    {
        return FiscalPeriod::query()->where('fiscal_year_id', $year->id)->pluck('id')->map(static fn ($i) => (int) $i)->all();
    }

    private function lastPeriod(FiscalYear $year): FiscalPeriod
    {
        return FiscalPeriod::query()->where('fiscal_year_id', $year->id)->orderByDesc('period_number')->firstOrFail();
    }
}
