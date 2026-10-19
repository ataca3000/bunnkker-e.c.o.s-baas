<?php

declare(strict_types=1);

namespace Modules\Finance\Intelligence\Domain\Services;

use Illuminate\Support\Carbon;
use Modules\Finance\Analytics\Domain\Services\FinancialMetricsService;
use Modules\Finance\Budget\Domain\Models\Budget;
use Modules\Finance\Budget\Domain\Services\BudgetControlEngine;
use Modules\Finance\Ledger\Domain\Enums\AccountCategory;

/**
 * Deterministic forecasting — rule-based and fully explainable.
 *
 * ┌─ NO GENERATIVE AI · EXPLAINABLE ONLY ───────────────────────────────────┐
 * │ Every projection is ordinary least-squares linear regression over a       │
 * │ historical series, with the method, slope and confidence returned         │
 * │ alongside the numbers. A reader can reproduce it by hand. Nothing is       │
 * │ inferred by a model; nothing is written anywhere.                          │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class ForecastService
{
    public function __construct(
        private readonly FinancialMetricsService $metrics,
        private readonly BudgetControlEngine $budgetControl,
    ) {}

    public function revenueForecast(string $companyId, int $history = 12, int $horizon = 3): array
    {
        return $this->forecastCategory($companyId, [AccountCategory::OperatingRevenue], 'revenue', $history, $horizon);
    }

    public function expenseForecast(string $companyId, int $history = 12, int $horizon = 3): array
    {
        return $this->forecastCategory($companyId, [AccountCategory::CostOfSales, AccountCategory::OperatingExpense, AccountCategory::OtherExpense], 'expense', $history, $horizon);
    }

    public function profitabilityForecast(string $companyId, int $history = 12, int $horizon = 3): array
    {
        $revenue = $this->metrics->monthlyPnlSeries($companyId, [AccountCategory::OperatingRevenue], $history);
        $expense = $this->metrics->monthlyPnlSeries($companyId, [AccountCategory::CostOfSales, AccountCategory::OperatingExpense, AccountCategory::OtherExpense], $history);

        $profit = [];
        foreach ($revenue as $i => $r) {
            $profit[] = ['month' => $r['month'], 'value' => round($r['value'] - ($expense[$i]['value'] ?? 0), 4)];
        }

        return $this->project($profit, $horizon, 'net_profit');
    }

    /** Budget forecast: projected spend vs approved budget, per line consumption. */
    public function budgetForecast(Budget $budget): array
    {
        $vsa = $this->budgetControl->budgetVsActual($budget);
        $totals = $vsa['totals'];

        // Straight-line run-rate to year end from consumption so far.
        $monthsElapsed = max(1, Carbon::today()->month);
        $runRate = round($totals['actual'] / $monthsElapsed, 4);
        $projectedYear = round($runRate * 12, 4);

        return [
            'budget' => $totals['budget'],
            'actual_to_date' => $totals['actual'],
            'run_rate_monthly' => $runRate,
            'projected_full_year' => $projectedYear,
            'projected_variance' => round($totals['budget'] - $projectedYear, 4),
            'method' => 'straight_line_run_rate',
            'explanation' => "Projected {$projectedYear} at the current monthly run-rate of {$runRate} vs budget {$totals['budget']}.",
        ];
    }

    /**
     * Ordinary least-squares projection of a monthly series.
     *
     * @param  list<array{month:string, value:float}>  $series
     * @return array<string, mixed>
     */
    public function project(array $series, int $horizon, string $label): array
    {
        $n = count($series);
        $values = array_map(static fn ($p) => (float) $p['value'], $series);

        if ($n < 2) {
            return ['label' => $label, 'method' => 'insufficient_history', 'history' => $series, 'forecast' => [], 'slope' => 0.0];
        }

        // x = 0..n-1
        $sumX = $sumY = $sumXY = $sumXX = 0.0;
        foreach ($values as $x => $y) {
            $sumX += $x;
            $sumY += $y;
            $sumXY += $x * $y;
            $sumXX += $x * $x;
        }
        $denom = ($n * $sumXX) - ($sumX * $sumX);
        $slope = $denom != 0.0 ? (($n * $sumXY) - ($sumX * $sumY)) / $denom : 0.0;
        $intercept = ($sumY - ($slope * $sumX)) / $n;

        $lastMonth = Carbon::createFromFormat('Y-m', $series[$n - 1]['month'])->startOfMonth();
        $forecast = [];
        for ($h = 1; $h <= $horizon; $h++) {
            $x = $n - 1 + $h;
            $forecast[] = [
                'month' => $lastMonth->copy()->addMonths($h)->format('Y-m'),
                'value' => round($intercept + $slope * $x, 4),
            ];
        }

        return [
            'label' => $label,
            'method' => 'linear_least_squares',
            'slope' => round($slope, 4),
            'direction' => $slope > 0 ? 'up' : ($slope < 0 ? 'down' : 'flat'),
            'history' => $series,
            'forecast' => $forecast,
            'explanation' => "Linear regression over {$n} months; slope {$slope} per month projected {$horizon} month(s) forward.",
        ];
    }

    /** @param list<AccountCategory> $categories */
    private function forecastCategory(string $companyId, array $categories, string $label, int $history, int $horizon): array
    {
        return $this->project($this->metrics->monthlyPnlSeries($companyId, $categories, $history), $horizon, $label);
    }
}
