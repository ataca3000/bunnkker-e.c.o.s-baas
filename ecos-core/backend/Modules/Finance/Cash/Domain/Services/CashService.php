<?php

declare(strict_types=1);

namespace Modules\Finance\Cash\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Modules\Finance\Cash\Domain\Models\CashAccount;
use Modules\Finance\Cash\Domain\Models\CashSession;
use Modules\Finance\Cash\Domain\Models\CashTransaction;
use Modules\Finance\Ledger\Domain\Enums\JournalType;
use Modules\Finance\Ledger\Domain\Exceptions\FinanceException;
use Modules\Finance\Ledger\Domain\ValueObjects\PostingLine;
use Modules\Finance\Ledger\Domain\ValueObjects\PostingRequest;
use Modules\Finance\Posting\Domain\Services\PostingCoordinator;

/**
 * Cash Management — tills, sessions and every cash movement.
 *
 * Never writes the general ledger: each transaction REQUESTS a journal from the
 * Posting Engine and stores it for a complete audit trail. A cash account's
 * balance is its GL account's balance — never stored. Transfers post one
 * balanced journal and record both legs.
 */
final class CashService
{
    private const SOURCE_MODULE = 'finance.cash';

    public function __construct(private readonly PostingCoordinator $coordinator) {}

    public function createAccount(
        string $companyId,
        string $code,
        string $name,
        int $glAccountId,
        ?string $branchId = null,
        string $currency = 'EGP',
    ): CashAccount {
        return CashAccount::create([
            'company_id' => $companyId,
            'code' => $code,
            'name' => $name,
            'gl_account_id' => $glAccountId,
            'branch_id' => $branchId,
            'currency' => $currency,
        ]);
    }

    /** Open a session on a cash account. Only one may be open at a time. */
    public function openSession(CashAccount $account, float $openingFloat = 0.0, ?int $actorId = null): CashSession
    {
        $open = $account->sessions()->where('status', 'open')->exists();
        if ($open) {
            throw FinanceException::cashSessionAlreadyOpen($account->code);
        }

        return CashSession::create([
            'company_id' => $account->company_id,
            'cash_account_id' => $account->id,
            'status' => 'open',
            'opening_float' => round($openingFloat, 4),
            'opened_at' => Carbon::now(),
            'opened_by' => $actorId,
        ]);
    }

    /**
     * Close a session, recording the counted cash. The over/short is the counted
     * amount against opening float plus the session's net movement — derived, not
     * stored.
     *
     * @return array{session:CashSession, expected:float, variance:float}
     */
    public function closeSession(CashSession $session, float $countedAmount, ?int $actorId = null): array
    {
        if (! $session->isOpen()) {
            throw FinanceException::cashSessionNotOpen();
        }

        $expected = round((float) $session->opening_float + $session->netMovement(), 4);
        $variance = round($countedAmount - $expected, 4);

        $session->update([
            'status' => 'closed',
            'counted_amount' => round($countedAmount, 4),
            'closed_at' => Carbon::now(),
            'closed_by' => $actorId,
        ]);

        return ['session' => $session->refresh(), 'expected' => $expected, 'variance' => $variance];
    }

    /**
     * Record a cash receipt (money in) or payment (money out) against a
     * counterparty income/expense account. Posts the balanced journal and stores
     * it on the transaction.
     */
    public function recordTransaction(
        CashAccount $account,
        string $type,
        float $amount,
        int $counterpartyAccountId,
        ?Carbon $date = null,
        ?string $description = null,
        ?int $actorId = null,
    ): CashTransaction {
        $amount = round($amount, 4);
        if ($amount <= 0.0) {
            throw FinanceException::allocationMustBePositive();
        }

        $date ??= Carbon::today();
        $session = $account->sessions()->where('status', 'open')->orderByDesc('id')->first();

        // Receipts and transfers-in increase cash (DR cash); payments and
        // transfers-out decrease it (CR cash).
        $cashIsDebit = in_array($type, ['receipt', 'transfer_in'], true);

        return DB::transaction(function () use ($account, $type, $amount, $counterpartyAccountId, $date, $description, $actorId, $session, $cashIsDebit): CashTransaction {
            // Post the journal FIRST, then record the transaction with the link
            // already set — the row is immutable the moment it exists.
            $uuid = (string) Str::uuid();
            $cashGl = (int) $account->gl_account_id;
            $lines = $cashIsDebit
                ? [PostingLine::debit($cashGl, $amount, $account->company_id), PostingLine::credit($counterpartyAccountId, $amount, $account->company_id)]
                : [PostingLine::debit($counterpartyAccountId, $amount, $account->company_id), PostingLine::credit($cashGl, $amount, $account->company_id)];

            $request = new PostingRequest(
                companyId: $account->company_id,
                entryDate: $date,
                lines: $lines,
                reference: 'CASH-'.substr($uuid, 0, 8),
                description: $description ?? ('Cash '.$type),
                source: 'posting',
                sourceModule: self::SOURCE_MODULE,
                sourceEventId: 'txn:'.$uuid,
                journalType: JournalType::Cash->value,
            );

            $journal = $this->coordinator->post(self::SOURCE_MODULE, 'txn:'.$uuid, $request, null, $actorId);

            return CashTransaction::create([
                'uuid' => $uuid,
                'company_id' => $account->company_id,
                'cash_account_id' => $account->id,
                'cash_session_id' => $session?->id,
                'transaction_type' => $type,
                'amount' => $amount,
                'transaction_date' => $date->toDateString(),
                'counterparty_account_id' => $counterpartyAccountId,
                'journal_entry_id' => $journal->id,
                'description' => $description,
                'status' => 'posted',
                'created_by' => $actorId,
            ]);
        });
    }

    /**
     * Transfer cash between two accounts. One balanced journal (DR destination,
     * CR source), two transaction legs sharing it.
     *
     * @return array{out:CashTransaction, in:CashTransaction}
     */
    public function transfer(
        CashAccount $from,
        CashAccount $to,
        float $amount,
        ?Carbon $date = null,
        ?string $description = null,
        ?int $actorId = null,
    ): array {
        $amount = round($amount, 4);
        if ($amount <= 0.0) {
            throw FinanceException::allocationMustBePositive();
        }
        $date ??= Carbon::today();

        return DB::transaction(function () use ($from, $to, $amount, $date, $description, $actorId): array {
            $fromSession = $from->sessions()->where('status', 'open')->orderByDesc('id')->first();
            $toSession = $to->sessions()->where('status', 'open')->orderByDesc('id')->first();

            // One balanced journal (DR destination, CR source), posted first.
            $transferId = (string) Str::uuid();
            $request = new PostingRequest(
                companyId: $from->company_id,
                entryDate: $date,
                lines: [
                    PostingLine::debit((int) $to->gl_account_id, $amount, $from->company_id),
                    PostingLine::credit((int) $from->gl_account_id, $amount, $from->company_id),
                ],
                reference: 'XFER-'.substr($transferId, 0, 8),
                description: $description ?? ('Cash transfer '.$from->code.' → '.$to->code),
                source: 'posting',
                sourceModule: self::SOURCE_MODULE,
                sourceEventId: 'transfer:'.$transferId,
                journalType: JournalType::Cash->value,
            );
            $journal = $this->coordinator->post(self::SOURCE_MODULE, 'transfer:'.$transferId, $request, null, $actorId);

            $out = CashTransaction::create([
                'company_id' => $from->company_id,
                'cash_account_id' => $from->id,
                'cash_session_id' => $fromSession?->id,
                'transaction_type' => 'transfer_out',
                'amount' => $amount,
                'transaction_date' => $date->toDateString(),
                'counterparty_account_id' => $to->gl_account_id,
                'journal_entry_id' => $journal->id,
                'description' => $description ?? ('Transfer to '.$to->code),
                'status' => 'posted',
                'created_by' => $actorId,
            ]);

            $in = CashTransaction::create([
                'company_id' => $to->company_id,
                'cash_account_id' => $to->id,
                'cash_session_id' => $toSession?->id,
                'transaction_type' => 'transfer_in',
                'amount' => $amount,
                'transaction_date' => $date->toDateString(),
                'counterparty_account_id' => $from->gl_account_id,
                'journal_entry_id' => $journal->id,
                'description' => $description ?? ('Transfer from '.$from->code),
                'status' => 'posted',
                'created_by' => $actorId,
            ]);

            return ['out' => $out, 'in' => $in];
        });
    }
}
