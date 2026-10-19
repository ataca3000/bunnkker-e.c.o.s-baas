<?php

declare(strict_types=1);

namespace Modules\Finance\Banking\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Finance\Banking\Domain\Models\BankAccount;
use Modules\Finance\Banking\Domain\Models\BankReconciliation;
use Modules\Finance\Banking\Domain\Models\BankReconciliationRule;
use Modules\Finance\Banking\Domain\Models\BankStatement;
use Modules\Finance\Banking\Domain\Models\BankStatementLine;
use Modules\Finance\Ledger\Domain\Enums\JournalStatus;
use Modules\Finance\Ledger\Domain\Enums\NormalBalance;
use Modules\Finance\Ledger\Domain\Exceptions\FinanceException;

/**
 * Bank Reconciliation — matches statement lines to book movements and proves the
 * bank balance ties to the ledger.
 *
 * ┌─ WRITES NO LEDGER · MATCHING IS PURE LINKING ───────────────────────────┐
 * │ Reconciliation never posts a journal. The book balance already lives in   │
 * │ the GL; reconciliation only records WHICH statement line corresponds to    │
 * │ which book movement (manual) or which rule cleared it (automatic). What is │
 * │ still unmatched is the set of outstanding items. It completes only when     │
 * │ the book balance plus those outstanding items equals the statement         │
 * │ balance — an unexplained difference blocks sign-off.                       │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class BankReconciliationService
{
    /** Open a reconciliation over a statement, snapshotting the balances. */
    public function start(BankStatement $statement, ?int $actorId = null): BankReconciliation
    {
        $statement->loadMissing('bankAccount');
        $bookBalance = $this->bookBalance($statement->bankAccount);
        $statementBalance = round((float) $statement->closing_balance, 4);

        $statement->update(['status' => 'reconciling']);

        return BankReconciliation::create([
            'company_id' => $statement->company_id,
            'bank_account_id' => $statement->bank_account_id,
            'bank_statement_id' => $statement->id,
            'reconciliation_date' => Carbon::today()->toDateString(),
            'book_balance' => $bookBalance,
            'statement_balance' => $statementBalance,
            'difference' => round($statementBalance - $bookBalance, 4),
            'status' => 'open',
            'created_by' => $actorId,
        ]);
    }

    /**
     * Automatic matching: for each unmatched line, try the account's active rules
     * in priority order; the first match clears the line. Returns the number of
     * lines matched.
     */
    public function autoMatch(BankReconciliation $reconciliation): int
    {
        $this->assertOpen($reconciliation);
        $reconciliation->loadMissing('statement.lines');

        $rules = BankReconciliationRule::query()
            ->where('company_id', $reconciliation->company_id)
            ->where('is_active', true)
            ->where(function ($q) use ($reconciliation): void {
                $q->whereNull('bank_account_id')->orWhere('bank_account_id', $reconciliation->bank_account_id);
            })
            ->orderBy('priority')
            ->orderBy('id')
            ->get();

        if ($rules->isEmpty()) {
            return 0;
        }

        $matched = 0;

        foreach ($reconciliation->statement->lines as $line) {
            if ($line->match_status !== 'unmatched') {
                continue;
            }

            foreach ($rules as $rule) {
                if ($rule->matches($line)) {
                    $line->update([
                        'match_status' => 'matched',
                        'matched_source_type' => 'rule',
                        'matched_source_id' => $rule->id,
                        'matched_rule_id' => $rule->id,
                        'reconciliation_id' => $reconciliation->id,
                    ]);
                    $matched++;
                    break;
                }
            }
        }

        return $matched;
    }

    /** Manual matching: link one statement line to a known book movement. */
    public function manualMatch(
        BankReconciliation $reconciliation,
        BankStatementLine $line,
        string $sourceType,
        int $sourceId,
    ): BankStatementLine {
        $this->assertOpen($reconciliation);

        if ($line->match_status === 'matched') {
            throw FinanceException::statementLineAlreadyMatched();
        }

        $line->update([
            'match_status' => 'matched',
            'matched_source_type' => $sourceType,
            'matched_source_id' => $sourceId,
            'reconciliation_id' => $reconciliation->id,
        ]);

        return $line->refresh();
    }

    /** Undo a match while the reconciliation is still open. */
    public function unmatch(BankReconciliation $reconciliation, BankStatementLine $line): BankStatementLine
    {
        $this->assertOpen($reconciliation);

        $line->update([
            'match_status' => 'unmatched',
            'matched_source_type' => null,
            'matched_source_id' => null,
            'matched_rule_id' => null,
            'reconciliation_id' => null,
        ]);

        return $line->refresh();
    }

    /**
     * The outstanding (unmatched) items on the reconciliation's statement — the
     * timing differences between the books and the bank.
     *
     * @return array{items:list<array<string,mixed>>, count:int, total:float}
     */
    public function outstandingItems(BankReconciliation $reconciliation): array
    {
        $lines = BankStatementLine::query()
            ->where('bank_statement_id', $reconciliation->bank_statement_id)
            ->where('match_status', 'unmatched')
            ->orderBy('value_date')
            ->get();

        return [
            'items' => $lines->map(fn (BankStatementLine $l): array => [
                'id' => $l->id,
                'value_date' => $l->value_date->toDateString(),
                'description' => $l->description,
                'amount' => round((float) $l->amount, 4),
            ])->all(),
            'count' => $lines->count(),
            'total' => round((float) $lines->sum('amount'), 4),
        ];
    }

    /**
     * Complete a reconciliation. Allowed only when the book balance plus the
     * outstanding items equals the statement balance — i.e. every difference is
     * explained. An unexplained residual blocks sign-off.
     */
    public function complete(BankReconciliation $reconciliation, ?int $actorId = null): BankReconciliation
    {
        $this->assertOpen($reconciliation);
        $reconciliation->loadMissing('bankAccount', 'statement');

        $bookBalance = $this->bookBalance($reconciliation->bankAccount);
        $statementBalance = round((float) $reconciliation->statement->closing_balance, 4);
        $outstanding = $this->outstandingItems($reconciliation)['total'];

        // Explained when book + not-yet-booked bank items == the bank's balance.
        $residual = round($statementBalance - ($bookBalance + $outstanding), 4);
        if ($residual !== 0.0) {
            throw FinanceException::reconciliationNotBalanced((string) $residual);
        }

        return DB::transaction(function () use ($reconciliation, $bookBalance, $statementBalance, $actorId): BankReconciliation {
            $reconciliation->update([
                'book_balance' => $bookBalance,
                'statement_balance' => $statementBalance,
                'difference' => round($statementBalance - $bookBalance, 4),
                'status' => 'completed',
                'completed_at' => Carbon::now(),
                'completed_by' => $actorId,
            ]);

            $reconciliation->statement->update(['status' => 'reconciled']);

            return $reconciliation->refresh();
        });
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    private function assertOpen(BankReconciliation $reconciliation): void
    {
        if ($reconciliation->isCompleted()) {
            throw FinanceException::reconciliationAlreadyCompleted();
        }
    }

    /** The GL bank account's balance, signed onto its normal side (debit asset). */
    private function bookBalance(BankAccount $account): float
    {
        $row = DB::table('finance_journal_lines as l')
            ->join('finance_journal_entries as e', 'e.id', '=', 'l.journal_entry_id')
            ->where('l.account_id', $account->gl_account_id)
            ->whereIn('e.status', [JournalStatus::Posted->value, JournalStatus::Reversed->value])
            ->selectRaw('COALESCE(SUM(l.debit), 0) as debit, COALESCE(SUM(l.credit), 0) as credit')
            ->first();

        $debit = (float) ($row->debit ?? 0);
        $credit = (float) ($row->credit ?? 0);

        $normal = $account->glAccount->normal_balance ?? NormalBalance::Debit;

        return round($normal === NormalBalance::Debit ? $debit - $credit : $credit - $debit, 4);
    }
}
