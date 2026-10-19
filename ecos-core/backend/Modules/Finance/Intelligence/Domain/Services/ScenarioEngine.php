<?php

declare(strict_types=1);

namespace Modules\Finance\Intelligence\Domain\Services;

use Illuminate\Support\Carbon;
use Modules\Finance\Analytics\Domain\Services\FinancialMetricsService;

/**
 * Read-only scenario engine — what-if simulation over the derived P&L.
 *
 * ┌─ SIMULATION ONLY · NO LEDGER MODIFICATION ──────────────────────────────┐
 * │ It reads the actual P&L once, applies percentage/absolute adjustments in   │
 * │ memory, and returns the recomputed metrics with the base, the scenario,    │
 * │ the deltas and the exact assumptions used. It writes nothing — not a        │
 * │ journal, not a budget, not a cache. A pure function of the inputs.          │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class ScenarioEngine
{
    public function __construct(private readonly FinancialMetricsService $metrics) {}

    /**
     * @param  array<string, float>  $adjustments  revenue_pct, cogs_pct, opex_pct,
     *                                              other_expense_pct, margin_target_pct
     * @return array<string, mixed>
     */
    public function simulate(string $companyId, Carbon $from, Carbon $to, array $adjustments): array
    {
        $base = $this->metrics->profitAndLoss($companyId, $from, $to);

        $revPct = (float) ($adjustments['revenue_pct'] ?? 0);
        $cogsPct = (float) ($adjustments['cogs_pct'] ?? 0);
        $opexPct = (float) ($adjustments['opex_pct'] ?? 0);
        $otherExpPct = (float) ($adjustments['other_expense_pct'] ?? 0);

        $revenue = round($base['revenue'] * (1 + $revPct / 100), 4);
        $otherRevenue = $base['other_revenue'];
        $cogs = round($base['cost_of_sales'] * (1 + $cogsPct / 100), 4);
        $opex = round($base['operating_expense'] * (1 + $opexPct / 100), 4);
        $otherExpense = round($base['other_expense'] * (1 + $otherExpPct / 100), 4);

        $grossProfit = round($revenue - $cogs, 4);
        $operatingProfit = round($grossProfit - $opex, 4);
        $totalRevenue = round($revenue + $otherRevenue, 4);
        $netProfit = round($totalRevenue - ($cogs + $opex + $otherExpense), 4);

        $scenario = [
            'revenue' => $revenue,
            'total_revenue' => $totalRevenue,
            'cost_of_sales' => $cogs,
            'gross_profit' => $grossProfit,
            'operating_expense' => $opex,
            'operating_profit' => $operatingProfit,
            'other_expense' => $otherExpense,
            'net_profit' => $netProfit,
            'gross_margin_pct' => $revenue != 0.0 ? round($grossProfit / $revenue * 100, 2) : 0.0,
            'net_margin_pct' => $totalRevenue != 0.0 ? round($netProfit / $totalRevenue * 100, 2) : 0.0,
        ];

        $result = [
            'base' => $base,
            'scenario' => $scenario,
            'deltas' => [
                'revenue' => round($scenario['total_revenue'] - $base['total_revenue'], 4),
                'net_profit' => round($scenario['net_profit'] - $base['net_profit'], 4),
                'net_margin_pct' => round($scenario['net_margin_pct'] - $base['net_margin_pct'], 2),
            ],
            'assumptions' => [
                'revenue_pct' => $revPct, 'cogs_pct' => $cogsPct,
                'opex_pct' => $opexPct, 'other_expense_pct' => $otherExpPct,
            ],
            'explanation' => "Applied revenue {$revPct}%, COGS {$cogsPct}%, OpEx {$opexPct}% to the actual P&L; net profit moves from {$base['net_profit']} to {$netProfit}.",
        ];

        // Margin simulation: revenue needed to hit a target net margin at this cost base.
        if (isset($adjustments['margin_target_pct'])) {
            $target = (float) $adjustments['margin_target_pct'];
            $costBase = round($cogs + $opex + $otherExpense, 4);
            $requiredRevenue = $target < 100 ? round($costBase / (1 - $target / 100), 4) : null;
            $result['margin_simulation'] = [
                'target_net_margin_pct' => $target,
                'cost_base' => $costBase,
                'required_total_revenue' => $requiredRevenue,
                'revenue_gap' => $requiredRevenue !== null ? round($requiredRevenue - $totalRevenue, 4) : null,
            ];
        }

        return $result;
    }
}
