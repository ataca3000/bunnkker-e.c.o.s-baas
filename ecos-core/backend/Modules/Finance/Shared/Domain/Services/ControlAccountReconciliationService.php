<?php

declare(strict_types=1);

namespace Modules\Finance\Shared\Domain\Services;

use Illuminate\Support\Facades\DB;
use Modules\Finance\Ledger\Domain\Enums\JournalStatus;
use Modules\Finance\Ledger\Domain\Enums\NormalBalance;
use Modules\Finance\Ledger\Domain\Models\Account;

/**
 * Control-Account Reconciliation — proves each subledger ties to the GL.
 *
 * ┌─ THE SUBLEDGER-TO-LEDGER INTEGRITY PROOF ───────────────────────────────┐
 * │ The AR/AP control account in the GL and the party ledger are two views of │
 * │ the same money. Because every party-ledger entry is written beside the    │
 * │ posting that moved the control account, their balances must be equal. This │
 * │ read model computes both — GL control balance vs Σ party-ledger — and      │
 * │ reports the difference. A non-zero difference is a defect, surfaced, never │
 * │ hidden. Both figures are derived; neither is stored.                       │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class ControlAccountReconciliationService
{
    public function __construct(private readonly ControlAccountResolver $controlAccounts) {}

    /** @return array<string, mixed> */
    public function receivable(string $companyId): array
    {
        $control = $this->controlAccounts->receivable($companyId);

        $subledger = round((float) DB::table('finance_customer_ledger_entries')
            ->where('company_id', $companyId)
            ->sum('amount'), 4);

        return $this->reconcile('ar', $control, $subledger);
    }

    /** @return array<string, mixed> */
    public function payable(string $companyId): array
    {
        $control = $this->controlAccounts->payable($companyId);

        $subledger = round((float) DB::table('finance_supplier_ledger_entries')
            ->where('company_id', $companyId)
            ->sum('amount'), 4);

        return $this->reconcile('ap', $control, $subledger);
    }

    /** @return array<string, mixed> */
    private function reconcile(string $subledgerCode, Account $control, float $subledgerBalance): array
    {
        $glBalance = $this->glControlBalance($control);
        $difference = round($glBalance - $subledgerBalance, 4);

        return [
            'subledger' => $subledgerCode,
            'control_account' => [
                'id' => $control->id,
                'code' => $control->code,
                'name' => $control->name,
            ],
            'gl_balance' => $glBalance,
            'subledger_balance' => $subledgerBalance,
            'difference' => $difference,
            'is_reconciled' => $difference === 0.0,
        ];
    }

    /** The control account's GL balance, signed onto its normal side. */
    private function glControlBalance(Account $control): float
    {
        $row = DB::table('finance_journal_lines as l')
            ->join('finance_journal_entries as e', 'e.id', '=', 'l.journal_entry_id')
            ->where('l.account_id', $control->id)
            ->whereIn('e.status', [JournalStatus::Posted->value, JournalStatus::Reversed->value])
            ->selectRaw('COALESCE(SUM(l.debit), 0) as debit, COALESCE(SUM(l.credit), 0) as credit')
            ->first();

        $debit = (float) ($row->debit ?? 0);
        $credit = (float) ($row->credit ?? 0);

        $net = $control->normal_balance === NormalBalance::Debit
            ? $debit - $credit
            : $credit - $debit;

        return round($net, 4);
    }
}
