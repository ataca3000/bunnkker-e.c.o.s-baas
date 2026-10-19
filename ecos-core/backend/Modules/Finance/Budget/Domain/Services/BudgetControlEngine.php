<?php

declare(strict_types=1);

namespace Modules\Finance\Budget\Domain\Services;

use Illuminate\Support\Facades\DB;
use Modules\Finance\Budget\Domain\Enums\BudgetDimension;
use Modules\Finance\Budget\Domain\Models\Budget;
use Modules\Finance\Budget\Domain\Models\BudgetControlRule;
use Modules\Finance\Budget\Domain\Models\BudgetLine;
use Modules\Finance\Fiscal\Domain\Models\FiscalPeriod;
use Modules\Finance\Ledger\Domain\Enums\JournalStatus;
use Modules\Finance\Ledger\Domain\Enums\NormalBalance;
use Modules\Finance\Ledger\Domain\Models\Account;

/**
 * Budget Control — budget vs actual, commitments, consumption, availability,
 * alerts and blocking.
 *
 * ┌─ READ-ONLY AGAINST FINANCE · DERIVED, NEVER STORED ─────────────────────┐
 * │ Actuals are aggregated live from the ledger; commitments from their own    │
 * │ table. Availability is budget − actual − committed, consumption is         │
 * │ (actual + committed) / budget — computed on read, never persisted, never   │
 * │ duplicated. The engine returns verdicts (ok / warn / block); it never       │
 * │ posts, never mutates a budget, never touches the ledger.                   │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class BudgetControlEngine
{
    /**
     * Budget vs actual for every line of a budget.
     *
     * @return array<string, mixed>
     */
    public function budgetVsActual(Budget $budget): array
    {
        $budget->loadMissing('lines');
        $periodMap = $this->periodMap((int) $budget->fiscal_year_id);
        $accounts = $this->accounts($budget->lines->pluck('account_id')->all());

        $lines = [];
        $totBudget = $totActual = $totCommitted = 0.0;

        foreach ($budget->lines as $line) {
            $row = $this->lineNumbers($budget, $line, $periodMap, $accounts);
            $lines[] = $row;
            $totBudget += $row['budget'];
            $totActual += $row['actual'];
            $totCommitted += $row['committed'];
        }

        return [
            'budget_id' => $budget->uuid,
            'lines' => $lines,
            'totals' => [
                'budget' => round($totBudget, 4),
                'actual' => round($totActual, 4),
                'committed' => round($totCommitted, 4),
                'available' => round($totBudget - $totActual - $totCommitted, 4),
                'consumption_pct' => $this->pct($totActual + $totCommitted, $totBudget),
            ],
        ];
    }

    /** Lines breaching their warn/block threshold — the alert feed. */
    public function alerts(Budget $budget): array
    {
        return array_values(array_filter(
            $this->budgetVsActual($budget)['lines'],
            static fn (array $l) => $l['status'] !== 'ok',
        ));
    }

    /**
     * Availability for a single (account, dimension, period) against the approved
     * budget of a fiscal year.
     *
     * @return array<string, mixed>
     */
    public function availability(
        string $companyId,
        int $fiscalYearId,
        int $accountId,
        BudgetDimension $dimension = BudgetDimension::Company,
        ?string $dimensionId = null,
        ?int $periodNumber = null,
    ): array {
        $budgetAmount = round((float) BudgetLine::query()
            ->join('finance_budgets as b', 'b.id', '=', 'finance_budget_lines.budget_id')
            ->where('b.company_id', $companyId)
            ->where('b.fiscal_year_id', $fiscalYearId)
            ->where('b.status', 'approved')
            ->where('finance_budget_lines.account_id', $accountId)
            ->where('finance_budget_lines.dimension_type', $dimension->value)
            ->when($dimensionId !== null, fn ($q) => $q->where('finance_budget_lines.dimension_id', $dimensionId))
            ->when($periodNumber !== null, fn ($q) => $q->where(function ($w) use ($periodNumber): void {
                $w->where('finance_budget_lines.period_number', $periodNumber)->orWhereNull('finance_budget_lines.period_number');
            }))
            ->sum('finance_budget_lines.amount'), 4);

        $periodMap = $this->periodMap($fiscalYearId);
        $periodIds = $periodNumber !== null && isset($periodMap[$periodNumber])
            ? [$periodMap[$periodNumber]]
            : array_values($periodMap);

        $account = Account::query()->find($accountId);
        $actual = $this->actual($companyId, $accountId, $account?->normal_balance ?? NormalBalance::Debit, $periodIds, $dimension, $dimensionId);
        $committed = $this->committed($companyId, $accountId, $dimension, $dimensionId, $periodNumber);

        return [
            'budget' => $budgetAmount,
            'actual' => $actual,
            'committed' => $committed,
            'available' => round($budgetAmount - $actual - $committed, 4),
            'consumption_pct' => $this->pct($actual + $committed, $budgetAmount),
        ];
    }

    /**
     * Evaluate a proposed spend against the budget and control rules — the
     * blocking primitive an operational flow calls before committing.
     *
     * @return array<string, mixed>
     */
    public function evaluate(
        string $companyId,
        int $fiscalYearId,
        int $accountId,
        float $amount,
        BudgetDimension $dimension = BudgetDimension::Company,
        ?string $dimensionId = null,
        ?int $periodNumber = null,
    ): array {
        $a = $this->availability($companyId, $fiscalYearId, $accountId, $dimension, $dimensionId, $periodNumber);
        $rule = $this->resolveRule($companyId, $accountId, $dimension, $dimensionId);

        $projected = round($a['actual'] + $a['committed'] + round($amount, 4), 4);
        $projectedPct = $this->pct($projected, $a['budget']);

        $verdict = 'ok';
        if ($a['budget'] > 0.0) {
            if ($rule['action'] === 'block' && $projectedPct >= $rule['block_pct']) {
                $verdict = 'blocked';
            } elseif ($projectedPct >= $rule['warn_pct']) {
                $verdict = 'warn';
            }
        }

        return [
            'verdict' => $verdict,
            'allowed' => $verdict !== 'blocked',
            'projected_consumption_pct' => $projectedPct,
            'available' => $a['available'],
            'budget' => $a['budget'],
            'warn_threshold_pct' => $rule['warn_pct'],
            'block_threshold_pct' => $rule['block_pct'],
        ];
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    /** @return array<string, mixed> */
    private function lineNumbers(Budget $budget, BudgetLine $line, array $periodMap, array $accounts): array
    {
        $periodIds = $line->period_number !== null && isset($periodMap[$line->period_number])
            ? [$periodMap[$line->period_number]]
            : array_values($periodMap);

        $account = $accounts[$line->account_id] ?? null;
        $budgetAmount = round((float) $line->amount, 4);
        $actual = $this->actual($budget->company_id, (int) $line->account_id, $account?->normal_balance ?? NormalBalance::Debit, $periodIds, $line->dimension_type, $line->dimension_id);
        $committed = $this->committed($budget->company_id, (int) $line->account_id, $line->dimension_type, $line->dimension_id, $line->period_number);

        $consumption = $this->pct($actual + $committed, $budgetAmount);
        $status = match (true) {
            $budgetAmount > 0 && $consumption >= 100.0 => 'over',
            $budgetAmount > 0 && $consumption >= 90.0 => 'warn',
            default => 'ok',
        };

        return [
            'line_id' => $line->uuid,
            'account_id' => $account?->uuid,
            'account_code' => $account?->code,
            'dimension_type' => $line->dimension_type->value,
            'dimension_id' => $line->dimension_id,
            'period_number' => $line->period_number,
            'budget' => $budgetAmount,
            'actual' => $actual,
            'committed' => $committed,
            'available' => round($budgetAmount - $actual - $committed, 4),
            'consumption_pct' => $consumption,
            'status' => $status,
        ];
    }

    /** The actual ledger movement on an account, signed onto its normal side. */
    private function actual(string $companyId, int $accountId, NormalBalance $normal, array $periodIds, BudgetDimension $dimension, ?string $dimensionId): float
    {
        if ($periodIds === []) {
            return 0.0;
        }

        $q = DB::table('finance_journal_lines as l')
            ->join('finance_journal_entries as e', 'e.id', '=', 'l.journal_entry_id')
            ->where('l.company_id', $companyId)
            ->where('l.account_id', $accountId)
            ->whereIn('e.status', [JournalStatus::Posted->value, JournalStatus::Reversed->value])
            ->whereIn('e.fiscal_period_id', $periodIds);

        $column = $dimension->ledgerColumn();
        if ($column !== null && $dimensionId !== null) {
            $q->where('l.'.$column, $dimensionId);
        }

        $row = $q->selectRaw('COALESCE(SUM(l.debit),0) as debit, COALESCE(SUM(l.credit),0) as credit')->first();
        $debit = (float) ($row->debit ?? 0);
        $credit = (float) ($row->credit ?? 0);

        return round($normal === NormalBalance::Debit ? $debit - $credit : $credit - $debit, 4);
    }

    private function committed(string $companyId, int $accountId, BudgetDimension $dimension, ?string $dimensionId, ?int $periodNumber): float
    {
        return round((float) DB::table('finance_budget_commitments')
            ->where('company_id', $companyId)
            ->where('account_id', $accountId)
            ->where('status', 'committed')
            ->where('dimension_type', $dimension->value)
            ->when($dimensionId !== null, fn ($q) => $q->where('dimension_id', $dimensionId))
            ->when($periodNumber !== null, fn ($q) => $q->where(function ($w) use ($periodNumber): void {
                $w->where('period_number', $periodNumber)->orWhereNull('period_number');
            }))
            ->sum('amount'), 4);
    }

    /** @return array{action:string, warn_pct:float, block_pct:float} */
    private function resolveRule(string $companyId, int $accountId, BudgetDimension $dimension, ?string $dimensionId): array
    {
        $rule = BudgetControlRule::query()
            ->where('company_id', $companyId)
            ->where('is_active', true)
            ->where(function ($q) use ($accountId, $dimension, $dimensionId): void {
                $q->where(function ($a) use ($accountId): void {
                    $a->where('scope', 'account')->where('account_id', $accountId);
                })->orWhere(function ($d) use ($dimension, $dimensionId): void {
                    $d->where('scope', 'dimension')->where('dimension_type', $dimension->value)->where('dimension_id', $dimensionId);
                })->orWhere('scope', 'global');
            })
            ->orderByRaw("CASE scope WHEN 'account' THEN 1 WHEN 'dimension' THEN 2 ELSE 3 END")
            ->first();

        return [
            'action' => $rule->action ?? 'warn',
            'warn_pct' => (float) ($rule->warn_threshold_pct ?? 90),
            'block_pct' => (float) ($rule->block_threshold_pct ?? 100),
        ];
    }

    /** @return array<int, int> period_number → period_id */
    private function periodMap(int $fiscalYearId): array
    {
        return FiscalPeriod::query()
            ->where('fiscal_year_id', $fiscalYearId)
            ->pluck('id', 'period_number')
            ->map(static fn ($id) => (int) $id)
            ->all();
    }

    /** @return array<int, Account> */
    private function accounts(array $ids): array
    {
        return Account::query()->whereIn('id', $ids)->get()->keyBy('id')->all();
    }

    private function pct(float $numerator, float $denominator): float
    {
        return $denominator > 0.0 ? round($numerator / $denominator * 100, 2) : ($numerator > 0.0 ? 100.0 : 0.0);
    }
}
