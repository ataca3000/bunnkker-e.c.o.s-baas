<?php

declare(strict_types=1);

namespace Modules\Finance\Workspace\Domain\Services;

use Illuminate\Support\Carbon;
use Modules\Finance\Analytics\Domain\Services\FinancialMetricsService;
use Modules\Finance\Budget\Domain\Models\Budget;
use Modules\Finance\Budget\Domain\Services\BudgetControlEngine;
use Modules\Finance\Controls\Domain\Services\ControlExceptionService;
use Modules\Finance\Intelligence\Domain\Services\CashFlowIntelligenceService;
use Modules\Finance\Receivables\Domain\Services\ArAgingService;
use Modules\Finance\Payables\Domain\Services\ApAgingService;

/**
 * The CFO Workspace — the daily decision surface.
 *
 * Daily summary, exceptions, budget performance, cash and liquidity, outstanding
 * AR/AP and a set of rule-based executive recommendations, each with the reason
 * it was raised. Read-only, composed from the kernel and the F2–F4 read models.
 */
final class CfoWorkspaceService
{
    public function __construct(
        private readonly FinancialMetricsService $metrics,
        private readonly CashFlowIntelligenceService $cashFlow,
        private readonly ControlExceptionService $exceptions,
        private readonly BudgetControlEngine $budgetControl,
        private readonly ArAgingService $arAging,
        private readonly ApAgingService $apAging,
    ) {}

    /** @return array<string, mixed> */
    public function overview(string $companyId): array
    {
        $to = Carbon::today();
        $mtdFrom = $to->copy()->startOfMonth();
        $pnl = $this->metrics->profitAndLoss($companyId, $mtdFrom, $to);

        $budgetPerformance = $this->budgetPerformance($companyId);

        return [
            'daily_summary' => [
                'as_of' => $to->toDateString(),
                'cash_position' => $this->metrics->cashPosition($companyId, $to),
                'month_to_date_revenue' => $pnl['total_revenue'],
                'month_to_date_expense' => round($pnl['cost_of_sales'] + $pnl['operating_expense'] + $pnl['other_expense'], 4),
                'month_to_date_profit' => $pnl['net_profit'],
            ],
            'financial_exceptions' => $this->exceptions->dashboard($companyId),
            'budget_performance' => $budgetPerformance,
            'cash_position' => $this->cashFlow->current($companyId),
            'outstanding_receivables' => $this->arAging->report($companyId)['totals'],
            'outstanding_payables' => $this->apAging->report($companyId)['totals'],
            'liquidity_overview' => $this->cashFlow->liquidityProjection($companyId, 3),
            'executive_recommendations' => $this->recommendations($companyId, $budgetPerformance),
        ];
    }

    /** @return array<string, mixed> */
    private function budgetPerformance(string $companyId): array
    {
        $budget = Budget::query()
            ->where('company_id', $companyId)
            ->where('status', 'approved')
            ->latest('id')
            ->first();

        if ($budget === null) {
            return ['available' => false, 'note' => 'No approved budget.'];
        }

        return ['available' => true] + $this->budgetControl->budgetVsActual($budget)['totals'] + ['budget_name' => $budget->name];
    }

    /**
     * Rule-based executive recommendations — each states the rule that fired.
     *
     * @return list<array<string, mixed>>
     */
    private function recommendations(string $companyId, array $budgetPerformance): array
    {
        $recs = [];

        foreach ($this->cashFlow->riskAlerts($companyId) as $alert) {
            $recs[] = ['category' => 'liquidity', 'priority' => $alert['severity'], 'recommendation' => $alert['message']];
        }

        $ar = $this->arAging->report($companyId)['totals'];
        if (($ar['90_plus'] ?? 0) > 0) {
            $recs[] = ['category' => 'collections', 'priority' => 'high',
                'recommendation' => "Escalate collection on {$ar['90_plus']} of receivables over 90 days."];
        }

        if (($budgetPerformance['available'] ?? false) && ($budgetPerformance['consumption_pct'] ?? 0) >= 90) {
            $recs[] = ['category' => 'budget', 'priority' => 'medium',
                'recommendation' => "Budget '{$budgetPerformance['budget_name']}' is {$budgetPerformance['consumption_pct']}% consumed; review remaining spend."];
        }

        if ($recs === []) {
            $recs[] = ['category' => 'general', 'priority' => 'info', 'recommendation' => 'No material financial risks detected.'];
        }

        return $recs;
    }
}
