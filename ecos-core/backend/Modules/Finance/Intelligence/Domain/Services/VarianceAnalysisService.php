<?php

declare(strict_types=1);

namespace Modules\Finance\Intelligence\Domain\Services;

use Modules\Finance\Budget\Domain\Models\Budget;
use Modules\Finance\Budget\Domain\Services\BudgetControlEngine;

/**
 * Variance analysis — budget vs actual with an explainable verdict per line.
 * Derived entirely from the F4 budget-control engine; no calculation is repeated
 * and nothing is written.
 */
final class VarianceAnalysisService
{
    public function __construct(private readonly BudgetControlEngine $budgetControl) {}

    /** @return array<string, mixed> */
    public function forBudget(Budget $budget): array
    {
        $vsa = $this->budgetControl->budgetVsActual($budget);

        $lines = array_map(static function (array $l): array {
            $variance = round($l['budget'] - $l['actual'], 4);
            $verdict = match (true) {
                $l['status'] === 'over' => 'over_budget',
                $l['status'] === 'warn' => 'approaching_limit',
                default => 'within_budget',
            };

            return $l + [
                'variance' => $variance,
                'variance_pct' => $l['budget'] != 0.0 ? round($variance / $l['budget'] * 100, 2) : 0.0,
                'verdict' => $verdict,
            ];
        }, $vsa['lines']);

        return [
            'budget_id' => $vsa['budget_id'],
            'totals' => $vsa['totals'] + ['variance' => round($vsa['totals']['budget'] - $vsa['totals']['actual'], 4)],
            'lines' => $lines,
            'over_budget_count' => count(array_filter($lines, static fn ($l) => $l['verdict'] === 'over_budget')),
        ];
    }
}
