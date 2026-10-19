<?php

declare(strict_types=1);

namespace Modules\Finance\Workspace\Domain\Services;

use Illuminate\Support\Carbon;
use Modules\Finance\Analytics\Domain\Services\FinancialMetricsService;
use Modules\Finance\Controls\Domain\Services\ControlExceptionService;
use Modules\Finance\Fiscal\Domain\Models\FiscalPeriod;
use Modules\Finance\Intelligence\Domain\Services\CashFlowIntelligenceService;

/**
 * The Executive Financial Workspace — the enterprise dashboard.
 *
 * A pure read model assembled from the metrics kernel, cash-flow intelligence and
 * the control register. Financial health, cash, revenue, expenses, profit,
 * working capital, KPIs, closing status and alerts — all derived, nothing stored.
 */
final class ExecutiveWorkspaceService
{
    public function __construct(
        private readonly FinancialMetricsService $metrics,
        private readonly CashFlowIntelligenceService $cashFlow,
        private readonly ControlExceptionService $exceptions,
    ) {}

    /** @return array<string, mixed> */
    public function overview(string $companyId, ?Carbon $from = null, ?Carbon $to = null): array
    {
        $to ??= Carbon::today();
        $from ??= $to->copy()->subMonths(11)->startOfMonth();

        $pnl = $this->metrics->profitAndLoss($companyId, $from, $to);
        $bs = $this->metrics->balanceSheet($companyId, $to);
        $health = $this->metrics->healthScore($companyId, $from, $to, $to);

        return [
            'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'financial_health' => $health,
            'cash_position' => $this->metrics->cashPosition($companyId, $to),
            'revenue' => $pnl['total_revenue'],
            'expenses' => round($pnl['cost_of_sales'] + $pnl['operating_expense'] + $pnl['other_expense'], 4),
            'profit' => $pnl['net_profit'],
            'working_capital' => $bs['working_capital'],
            'financial_kpis' => [
                'gross_margin_pct' => $pnl['gross_margin_pct'],
                'operating_margin_pct' => $pnl['operating_margin_pct'],
                'net_margin_pct' => $pnl['net_margin_pct'],
                'current_ratio' => $bs['current_ratio'],
                'receivables' => $this->metrics->receivables($companyId),
                'payables' => $this->metrics->payables($companyId),
            ],
            'closing_status' => $this->closingStatus($companyId),
            'alerts' => $this->alerts($companyId),
        ];
    }

    /** @return array<string, mixed> */
    private function closingStatus(string $companyId): array
    {
        $counts = FiscalPeriod::query()
            ->where('company_id', $companyId)
            ->selectRaw('status, COUNT(*) as n')
            ->groupBy('status')
            ->pluck('n', 'status')
            ->all();

        return [
            'open' => (int) ($counts['open'] ?? 0),
            'closed' => (int) ($counts['closed'] ?? 0),
            'locked' => (int) ($counts['locked'] ?? 0),
            'future' => (int) ($counts['future'] ?? 0),
        ];
    }

    /** @return list<array<string, mixed>> */
    private function alerts(string $companyId): array
    {
        $alerts = $this->cashFlow->riskAlerts($companyId);

        $dashboard = $this->exceptions->dashboard($companyId);
        if (($dashboard['critical_open'] ?? 0) > 0) {
            $alerts[] = ['key' => 'control_exceptions', 'severity' => 'critical', 'message' => "{$dashboard['critical_open']} open critical control exception(s)."];
        }

        return $alerts;
    }
}
