<?php

declare(strict_types=1);

namespace Modules\Finance\Vat\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Finance\Integration\Domain\Services\AccountRoleResolver;
use Modules\Finance\Ledger\Domain\Enums\JournalStatus;
use Modules\Finance\Ledger\Domain\Enums\JournalType;
use Modules\Finance\Ledger\Domain\Enums\NormalBalance;
use Modules\Finance\Ledger\Domain\Exceptions\FinanceException;
use Modules\Finance\Ledger\Domain\Models\Account;
use Modules\Finance\Ledger\Domain\ValueObjects\PostingLine;
use Modules\Finance\Ledger\Domain\ValueObjects\PostingRequest;
use Modules\Finance\Posting\Domain\Services\PostingCoordinator;
use Modules\Finance\Vat\Domain\Enums\VatPeriodStatus;
use Modules\Finance\Vat\Domain\Models\VatPeriod;
use Modules\Finance\Vat\Domain\Models\VatReturn;

/**
 * VAT Operations — periods, returns, settlement and reports.
 *
 * ┌─ INDEPENDENT ENGINE · DERIVED FIGURES · POSTS VIA THE ENGINE ───────────┐
 * │ Return figures are computed live from the ledger's VAT accounts over the  │
 * │ period window — never stored except as a filed snapshot. Settlement posts  │
 * │ through the Posting Engine (output and recoverable input VAT swept to VAT   │
 * │ payable); the VAT engine writes no ledger directly and depends on NO        │
 * │ e-invoicing/ETA integration.                                              │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class VatService
{
    private const SOURCE_MODULE = 'finance.vat';

    public function __construct(
        private readonly PostingCoordinator $coordinator,
        private readonly AccountRoleResolver $roles,
    ) {}

    public function createPeriod(string $companyId, string $name, Carbon $start, Carbon $end, ?int $createdBy = null): VatPeriod
    {
        return VatPeriod::create([
            'company_id' => $companyId,
            'name' => $name,
            'start_date' => $start->toDateString(),
            'end_date' => $end->toDateString(),
            'status' => VatPeriodStatus::Open->value,
            'created_by' => $createdBy,
        ]);
    }

    /** The live, derived figures for a period. Read-only. */
    public function figures(VatPeriod $period): array
    {
        $output = $this->balance($period, 'vat_output', NormalBalance::Credit);
        $inputRecoverable = $this->balance($period, 'vat_input', NormalBalance::Debit);
        $inputNonRecoverable = $this->isMapped($period->company_id, 'vat_input_non_recoverable')
            ? $this->balance($period, 'vat_input_non_recoverable', NormalBalance::Debit)
            : 0.0;

        return [
            'output_vat' => $output,
            'input_vat_recoverable' => $inputRecoverable,
            'input_vat_non_recoverable' => $inputNonRecoverable,
            'net_payable' => round($output - $inputRecoverable, 4),
        ];
    }

    /** Snapshot the current figures as a VAT return (the filed document). */
    public function generateReturn(VatPeriod $period): VatReturn
    {
        if ($period->isSettled()) {
            throw FinanceException::vatPeriodSettled($period->name);
        }

        $f = $this->figures($period);

        return DB::transaction(function () use ($period, $f): VatReturn {
            $return = VatReturn::create([
                'company_id' => $period->company_id,
                'vat_period_id' => $period->id,
                'output_vat' => $f['output_vat'],
                'input_vat_recoverable' => $f['input_vat_recoverable'],
                'input_vat_non_recoverable' => $f['input_vat_non_recoverable'],
                'net_payable' => $f['net_payable'],
                'status' => 'draft',
                'generated_at' => Carbon::now(),
            ]);

            $period->update(['status' => VatPeriodStatus::ReturnGenerated->value]);

            return $return;
        });
    }

    /**
     * Settle a period: post the settlement journal (DR output VAT, CR recoverable
     * input VAT, net to VAT payable) through the Posting Engine, and mark settled.
     */
    public function settle(VatPeriod $period, ?int $actorId = null): VatPeriod
    {
        if ($period->isSettled()) {
            throw FinanceException::vatPeriodSettled($period->name);
        }

        $companyId = $period->company_id;
        $output = $this->balance($period, 'vat_output', NormalBalance::Credit);
        $input = $this->balance($period, 'vat_input', NormalBalance::Debit);
        $net = round($output - $input, 4);

        $outputAcc = $this->roles->resolve($companyId, 'vat_output');
        $inputAcc = $this->roles->resolve($companyId, 'vat_input');
        $payableAcc = $this->roles->resolve($companyId, 'vat_payable');

        $lines = [];
        if ($output > 0.0) {
            $lines[] = PostingLine::debit($outputAcc, $output, $companyId);
        }
        if ($input > 0.0) {
            $lines[] = PostingLine::credit($inputAcc, $input, $companyId);
        }
        if ($net > 0.0) {
            $lines[] = PostingLine::credit($payableAcc, $net, $companyId);
        } elseif ($net < 0.0) {
            $lines[] = PostingLine::debit($payableAcc, abs($net), $companyId);
        }

        if (count($lines) < 2) {
            throw new FinanceException('There is no VAT to settle for this period.');
        }

        $request = new PostingRequest(
            companyId: $companyId,
            entryDate: Carbon::parse($period->end_date),
            lines: $lines,
            reference: 'VAT-'.$period->name,
            description: 'VAT settlement '.$period->name,
            source: 'posting',
            sourceModule: self::SOURCE_MODULE,
            sourceEventId: 'settlement:'.$period->uuid,
            journalType: JournalType::General->value,
        );

        return DB::transaction(function () use ($period, $request, $actorId): VatPeriod {
            $journal = $this->coordinator->post(self::SOURCE_MODULE, 'settlement:'.$period->uuid, $request, null, $actorId);

            $period->update([
                'status' => VatPeriodStatus::Settled->value,
                'settlement_journal_id' => $journal->id,
                'settled_by' => $actorId,
                'settled_at' => Carbon::now(),
            ]);

            VatReturn::query()->where('vat_period_id', $period->id)->latest('id')->first()?->update(['status' => 'settled']);

            return $period->refresh();
        });
    }

    /** @return array<string, mixed> */
    public function report(VatPeriod $period): array
    {
        return array_merge(
            ['period' => $period->name, 'status' => $period->status->value, 'window' => [$period->start_date?->toDateString(), $period->end_date?->toDateString()]],
            $this->figures($period),
        );
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    private function balance(VatPeriod $period, string $role, NormalBalance $normal): float
    {
        $accountId = $this->roles->resolve($period->company_id, $role);

        $row = DB::table('finance_journal_lines as l')
            ->join('finance_journal_entries as e', 'e.id', '=', 'l.journal_entry_id')
            ->where('l.company_id', $period->company_id)
            ->where('l.account_id', $accountId)
            ->whereIn('e.status', [JournalStatus::Posted->value, JournalStatus::Reversed->value])
            ->whereBetween('e.entry_date', [$period->start_date->toDateString(), $period->end_date->toDateString()])
            ->selectRaw('COALESCE(SUM(l.debit),0) as debit, COALESCE(SUM(l.credit),0) as credit')
            ->first();

        $debit = (float) ($row->debit ?? 0);
        $credit = (float) ($row->credit ?? 0);

        return round($normal === NormalBalance::Debit ? $debit - $credit : $credit - $debit, 4);
    }

    private function isMapped(string $companyId, string $role): bool
    {
        return $this->roles->isMapped($companyId, $role);
    }
}
