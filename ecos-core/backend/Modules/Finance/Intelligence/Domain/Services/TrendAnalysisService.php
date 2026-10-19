<?php

declare(strict_types=1);

namespace Modules\Finance\Intelligence\Domain\Services;

use Modules\Finance\Analytics\Domain\Services\FinancialMetricsService;
use Modules\Finance\Ledger\Domain\Enums\AccountCategory;

/**
 * Deterministic trend analysis — revenue, expense, profit and margin over time,
 * each with a direction, period-over-period change and average. Explainable,
 * read-only, computed from the metrics kernel.
 */
final class TrendAnalysisService
{
    public function __construct(private readonly FinancialMetricsService $metrics) {}

    /** @return array<string, mixed> */
    public function revenue(string $companyId, int $months = 12): array
    {
        return $this->trend('revenue', $this->metrics->monthlyPnlSeries($companyId, [AccountCategory::OperatingRevenue], $months));
    }

    /** @return array<string, mixed> */
    public function expense(string $companyId, int $months = 12): array
    {
        return $this->trend('expense', $this->metrics->monthlyPnlSeries(
            $companyId, [AccountCategory::CostOfSales, AccountCategory::OperatingExpense, AccountCategory::OtherExpense], $months,
        ));
    }

    /** @return array<string, mixed> */
    public function profit(string $companyId, int $months = 12): array
    {
        $revenue = $this->metrics->monthlyPnlSeries($companyId, [AccountCategory::OperatingRevenue], $months);
        $expense = $this->metrics->monthlyPnlSeries($companyId, [AccountCategory::CostOfSales, AccountCategory::OperatingExpense, AccountCategory::OtherExpense], $months);

        $series = [];
        foreach ($revenue as $i => $r) {
            $series[] = ['month' => $r['month'], 'value' => round($r['value'] - ($expense[$i]['value'] ?? 0), 4)];
        }

        return $this->trend('profit', $series);
    }

    /** @return array<string, mixed> */
    public function margin(string $companyId, int $months = 12): array
    {
        $revenue = $this->metrics->monthlyPnlSeries($companyId, [AccountCategory::OperatingRevenue], $months);
        $expense = $this->metrics->monthlyPnlSeries($companyId, [AccountCategory::CostOfSales, AccountCategory::OperatingExpense, AccountCategory::OtherExpense], $months);

        $series = [];
        foreach ($revenue as $i => $r) {
            $rev = (float) $r['value'];
            $profit = $rev - ($expense[$i]['value'] ?? 0);
            $series[] = ['month' => $r['month'], 'value' => $rev != 0.0 ? round($profit / $rev * 100, 2) : 0.0];
        }

        return $this->trend('margin_pct', $series);
    }

    /**
     * @param  list<array{month:string, value:float}>  $series
     * @return array<string, mixed>
     */
    private function trend(string $label, array $series): array
    {
        $values = array_map(static fn ($p) => (float) $p['value'], $series);
        $n = count($values);
        $first = $values[0] ?? 0.0;
        $last = $values[$n - 1] ?? 0.0;
        $avg = $n > 0 ? round(array_sum($values) / $n, 4) : 0.0;

        $change = round($last - $first, 4);
        $changePct = $first != 0.0 ? round($change / abs($first) * 100, 2) : 0.0;

        return [
            'label' => $label,
            'series' => $series,
            'first' => round($first, 4),
            'last' => round($last, 4),
            'average' => $avg,
            'change' => $change,
            'change_pct' => $changePct,
            'direction' => $change > 0 ? 'up' : ($change < 0 ? 'down' : 'flat'),
            'explanation' => "{$label} moved from {$first} to {$last} ({$changePct}%) over {$n} months.",
        ];
    }
}
