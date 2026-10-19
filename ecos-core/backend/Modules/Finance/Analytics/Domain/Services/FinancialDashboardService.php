<?php

declare(strict_types=1);

namespace Modules\Finance\Analytics\Domain\Services;

use Illuminate\Support\Carbon;
use Modules\Finance\Budget\Domain\Models\Budget;
use Modules\Finance\Budget\Domain\Services\BudgetControlEngine;
use Modules\Finance\Intelligence\Domain\Services\ForecastService;
use Modules\Finance\Intelligence\Domain\Services\TrendAnalysisService;
use Modules\Finance\Vat\Domain\Models\VatPeriod;
use Modules\Finance\Vat\Domain\Services\VatService;
use Throwable;

/**
 * Financial analytics dashboards — revenue, expense, margin, profit, budget, VAT
 * and the executive KPI board. Each composes the metrics kernel and the
 * intelligence services; none re-implements the arithmetic. Read-only.
 */
final class FinancialDashboardService
{
    public function __construct(
        private readonly FinancialMetricsService $metrics,
        private readonly TrendAnalysisService $trends,
        private readonly ForecastService $forecast,
        private readonly BudgetControlEngine $budgetControl,
        private readonly VatService $vat,
    ) {}

    /** @return array<string, mixed> */
    public function revenue(string $companyId, Carbon $from, Carbon $to): array
    {
        return [
            'total' => $this->metrics->profitAndLoss($companyId, $from, $to)['total_revenue'],
            'trend' => $this->trends->revenue($companyId),
            'forecast' => $this->forecast->revenueForecast($companyId),
        ];
    }

    /** @return array<string, mixed> */
    public function expense(string $companyId, Carbon $from, Carbon $to): array
    {
        $pnl = $this->metrics->profitAndLoss($companyId, $from, $to);

        return [
            'total' => round($pnl['cost_of_sales'] + $pnl['operating_expense'] + $pnl['other_expense'], 4),
            'trend' => $this->trends->expense($companyId),
            'forecast' => $this->forecast->expenseForecast($companyId),
        ];
    }

    /** @return array<string, mixed> */
    public function margin(string $companyId, Carbon $from, Carbon $to): array
    {
        $pnl = $this->metrics->profitAndLoss($companyId, $from, $to);

        return [
            'gross_margin_pct' => $pnl['gross_margin_pct'],
            'operating_margin_pct' => $pnl['operating_margin_pct'],
            'net_margin_pct' => $pnl['net_margin_pct'],
            'trend' => $this->trends->margin($companyId),
        ];
    }

    /** @return array<string, mixed> */
    public function profit(string $companyId, Carbon $from, Carbon $to): array
    {
        return [
            'net_profit' => $this->metrics->profitAndLoss($companyId, $from, $to)['net_profit'],
            'trend' => $this->trends->profit($companyId),
            'forecast' => $this->forecast->profitabilityForecast($companyId),
        ];
    }

    /** @return array<string, mixed> */
    public function budget(string $companyId): array
    {
        $budget = Budget::query()->where('company_id', $companyId)->where('status', 'approved')->latest('id')->first();
        if ($budget === null) {
            return ['available' => false, 'note' => 'No approved budget.'];
        }

        return ['available' => true, 'budget' => $budget->name] + $this->budgetControl->budgetVsActual($budget);
    }

    /** @return array<string, mixed> */
    public function vat(string $companyId): array
    {
        $periods = VatPeriod::query()->where('company_id', $companyId)->latest('id')->limit(6)->get();

        return [
            'periods' => $periods->map(function (VatPeriod $p): array {
                $figures = null;
                try {
                    $figures = $this->vat->figures($p);
                } catch (Throwable) {
                    // VAT roles not mapped — figures unavailable, listing still works.
                }

                return ['name' => $p->name, 'status' => $p->status->value, 'figures' => $figures];
            })->all(),
        ];
    }

    /** @return array<string, mixed> */
    public function executiveKpis(string $companyId, Carbon $from, Carbon $to): array
    {
        $pnl = $this->metrics->profitAndLoss($companyId, $from, $to);
        $bs = $this->metrics->balanceSheet($companyId, $to);

        return [
            'health' => $this->metrics->healthScore($companyId, $from, $to, $to),
            'revenue' => $pnl['total_revenue'],
            'net_profit' => $pnl['net_profit'],
            'net_margin_pct' => $pnl['net_margin_pct'],
            'cash_position' => $this->metrics->cashPosition($companyId, $to),
            'working_capital' => $bs['working_capital'],
            'current_ratio' => $bs['current_ratio'],
            'receivables' => $this->metrics->receivables($companyId),
            'payables' => $this->metrics->payables($companyId),
        ];
    }
}
