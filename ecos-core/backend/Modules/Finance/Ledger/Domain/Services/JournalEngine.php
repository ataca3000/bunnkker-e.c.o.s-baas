<?php

declare(strict_types=1);

namespace Modules\Finance\Ledger\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Finance\Fiscal\Domain\Models\FiscalPeriod;
use Modules\Finance\Ledger\Domain\Enums\JournalStatus;
use Modules\Finance\Ledger\Domain\Enums\JournalType;
use Modules\Finance\Ledger\Domain\Exceptions\FinanceException;
use Modules\Finance\Ledger\Domain\Models\Account;
use Modules\Finance\Ledger\Domain\Models\JournalEntry;
use Modules\Finance\Ledger\Domain\ValueObjects\PostingLine;
use Modules\Finance\Ledger\Domain\ValueObjects\PostingRequest;

/**
 * The Journal Engine — the ONE and ONLY writer of the general ledger.
 *
 * ┌─ THE INTEGRITY BOUNDARY ────────────────────────────────────────────────┐
 * │ Nothing else writes finance_journal_entries or finance_journal_lines.    │
 * │ The Posting Engine and every future subledger REQUEST journals here;     │
 * │ they never touch the tables. Every write passes the same gates:          │
 * │                                                                          │
 * │   1. balanced — Σ debit = Σ credit, non-zero, ≥ 2 lines                   │
 * │   2. postable — every account exists, is postable, is active             │
 * │   3. in period — an OPEN fiscal period covers the entry date             │
 * │                                                                          │
 * │ A posted entry is immutable; a correction is a reversing entry. There is │
 * │ no update path to a ledger figure anywhere in the platform.              │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
class JournalEngine
{
    /**
     * Post a balanced request straight to the ledger (system / event path).
     */
    public function post(PostingRequest $request, ?int $postedBy = null): JournalEntry
    {
        $this->assertIntegrity($request);
        $period = $this->assertOpenPeriod($request->companyId, $request->entryDate);

        return DB::transaction(function () use ($request, $period, $postedBy) {
            $entry = JournalEntry::create([
                'company_id' => $request->companyId,
                'fiscal_period_id' => $period->id,
                'entry_date' => $request->entryDate->toDateString(),
                'reference' => $request->reference,
                'description' => $request->description,
                'source' => $request->source,
                'journal_type' => $request->journalType,
                'source_module' => $request->sourceModule,
                'source_event_id' => $request->sourceEventId,
                'status' => JournalStatus::Posted->value,
                'created_by' => $postedBy,
                'approved_by' => $postedBy,
                'posted_by' => $postedBy,
                'posted_at' => Carbon::now(),
            ]);

            $this->writeLines($entry, $request->lines);

            return $entry->refresh();
        });
    }

    /**
     * Maker step — record a manual journal as a DRAFT (not yet in the ledger).
     * The draft's lines are written immutably; the checker cannot silently edit
     * them, only approve or discard.
     */
    public function submitDraft(PostingRequest $request, int $makerId): JournalEntry
    {
        $this->assertIntegrity($request);
        // A period must exist; it need not be open until the checker posts.
        $period = $this->resolvePeriod($request->companyId, $request->entryDate);

        return DB::transaction(function () use ($request, $period, $makerId) {
            $entry = JournalEntry::create([
                'company_id' => $request->companyId,
                'fiscal_period_id' => $period->id,
                'entry_date' => $request->entryDate->toDateString(),
                'reference' => $request->reference,
                'description' => $request->description,
                'source' => 'manual',
                'journal_type' => JournalType::Manual->value,
                'status' => JournalStatus::Draft->value,
                'created_by' => $makerId,
            ]);

            $this->writeLines($entry, $request->lines);

            return $entry->refresh();
        });
    }

    /**
     * Checker step — approve a draft and post it.
     *
     * Segregation of duties: the checker may not be the maker. The period must
     * be open at posting time.
     */
    public function approveAndPost(JournalEntry $entry, int $checkerId): JournalEntry
    {
        if ($entry->status !== JournalStatus::Draft) {
            throw FinanceException::journalImmutable();
        }

        if ((int) $entry->created_by === $checkerId) {
            throw FinanceException::makerCannotApproveOwn();
        }

        $period = $entry->period;
        if ($period === null || ! $period->acceptsPostings()) {
            throw FinanceException::periodNotOpen(
                $period?->name ?? 'unknown',
                $period?->status->value ?? 'missing',
            );
        }

        $entry->update([
            'status' => JournalStatus::Posted->value,
            'approved_by' => $checkerId,
            'posted_by' => $checkerId,
            'posted_at' => Carbon::now(),
        ]);

        return $entry->refresh();
    }

    /**
     * Correct a posted entry with a reversing entry — the only sanctioned
     * correction. The reversal swaps every debit and credit, posts into the
     * open period covering today, and links both entries.
     */
    public function reverse(JournalEntry $entry, string $reason, ?int $actorId = null): JournalEntry
    {
        if ($entry->status === JournalStatus::Draft) {
            throw FinanceException::cannotReverseDraft();
        }

        // A reversed entry (or one already linked to a reversal) cannot be
        // reversed again — checked before the posted guard so the reason is
        // specific.
        if ($entry->status === JournalStatus::Reversed || $entry->reversed_by_journal_id !== null) {
            throw FinanceException::alreadyReversed();
        }

        $today = Carbon::today();
        $period = $this->assertOpenPeriod($entry->company_id, $today);

        return DB::transaction(function () use ($entry, $reason, $actorId, $period, $today) {
            $reversal = JournalEntry::create([
                'company_id' => $entry->company_id,
                'fiscal_period_id' => $period->id,
                'entry_date' => $today->toDateString(),
                'reference' => $entry->reference,
                'description' => 'Reversal of '.$entry->uuid,
                'source' => 'manual',
                'journal_type' => JournalType::Reversal->value,
                'status' => JournalStatus::Posted->value,
                'reverses_journal_id' => $entry->id,
                'reversal_reason' => $reason,
                'created_by' => $actorId,
                'approved_by' => $actorId,
                'posted_by' => $actorId,
                'posted_at' => Carbon::now(),
            ]);

            // Swap each side — the mirror image, guaranteed still balanced.
            $mirrored = $entry->lines->map(fn ($line) => new PostingLine(
                accountId: (int) $line->account_id,
                debit: (float) $line->credit,
                credit: (float) $line->debit,
                companyId: (string) $line->company_id,
                branchId: $line->branch_id,
                costCenterId: $line->cost_center_id === null ? null : (int) $line->cost_center_id,
                description: 'Reversal',
                profitCenterId: $line->profit_center_id,
                projectId: $line->project_id,
                campaignId: $line->campaign_id,
                currency: (string) $line->currency,
            ))->all();

            $this->writeLines($reversal, $mirrored);

            $entry->update([
                'status' => JournalStatus::Reversed->value,
                'reversed_by_journal_id' => $reversal->id,
            ]);

            return $reversal->refresh();
        });
    }

    /** Discard a pre-ledger draft. Refuses anything posted. */
    public function discardDraft(JournalEntry $entry): void
    {
        if ($entry->status !== JournalStatus::Draft) {
            throw FinanceException::journalImmutable();
        }

        DB::transaction(function () use ($entry) {
            $entry->lines()->delete();
            $entry->delete();
        });
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    /** @param list<PostingLine> $lines */
    private function writeLines(JournalEntry $entry, array $lines): void
    {
        $number = 1;

        foreach ($lines as $line) {
            $entry->lines()->create([
                'account_id' => $line->accountId,
                'debit' => $line->debit,
                'credit' => $line->credit,
                'description' => $line->description,
                'line_number' => $number++,
                'company_id' => $line->companyId,
                'branch_id' => $line->branchId,
                'cost_center_id' => $line->costCenterId,
                'profit_center_id' => $line->profitCenterId,
                'project_id' => $line->projectId,
                'campaign_id' => $line->campaignId,
                'currency' => $line->currency,
            ]);
        }
    }

    /** The three hard invariants, enforced no matter who calls. */
    private function assertIntegrity(PostingRequest $request): void
    {
        if ($request->lineCount() < 2) {
            throw FinanceException::noLines();
        }

        if ($request->isZero()) {
            throw FinanceException::zeroValue();
        }

        if (! $request->isBalanced()) {
            throw FinanceException::unbalanced(
                (string) $request->totalDebit(),
                (string) $request->totalCredit(),
            );
        }

        $accountIds = array_values(array_unique(array_map(
            static fn (PostingLine $l) => $l->accountId,
            $request->lines,
        )));

        $accounts = Account::query()->whereIn('id', $accountIds)->get()->keyBy('id');

        foreach ($accountIds as $id) {
            $account = $accounts->get($id);

            if ($account === null) {
                throw FinanceException::accountNotFound((string) $id);
            }
            if (! $account->is_postable) {
                throw FinanceException::accountNotPostable($account->code);
            }
            if (! $account->is_active) {
                throw FinanceException::accountInactive($account->code);
            }
            // A control account is the GL side of a subledger and is moved ONLY
            // by that subledger's postings (F3) — never by a manual journal.
            if ($request->isManual() && $account->is_control) {
                throw FinanceException::controlAccountManual($account->code);
            }
        }
    }

    private function resolvePeriod(string $companyId, Carbon $date): FiscalPeriod
    {
        $period = FiscalPeriod::query()
            ->where('company_id', $companyId)
            ->whereDate('start_date', '<=', $date->toDateString())
            ->whereDate('end_date', '>=', $date->toDateString())
            ->first();

        if ($period === null) {
            throw FinanceException::noPeriodForDate($date->toDateString());
        }

        return $period;
    }

    private function assertOpenPeriod(string $companyId, Carbon $date): FiscalPeriod
    {
        $period = $this->resolvePeriod($companyId, $date);

        if (! $period->acceptsPostings()) {
            throw FinanceException::periodNotOpen($period->name, $period->status->value);
        }

        return $period;
    }
}
