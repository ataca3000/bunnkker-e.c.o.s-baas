<?php

declare(strict_types=1);

namespace Modules\Crm\Executive\Domain\Services;

use Modules\Crm\Executive\Domain\Support\ExecutivePeriod;
use Modules\Crm\Executive\Domain\Support\ExecutiveThresholds;

/**
 * The executive dashboard — every CRM signal on one page.
 *
 * ┌─ A COMPOSER, NOT A CALCULATOR ──────────────────────────────────────────┐
 * │ This holds no formulas of its own. Each domain answers for its own numbers  │
 * │ (C3 for service, C4 for sales and loyalty, C5 for retention and value), and  │
 * │ the dashboard assembles them into one payload with a period and its         │
 * │ comparison. Read-only end to end: no writes, no snapshots, no cached truth.  │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class ExecutiveDashboardService
{
    public function __construct(
        private readonly CustomerKpiService $kpis,
        private readonly CustomerGrowthService $growth,
        private readonly RetentionMetricsService $retention,
        private readonly LifetimeValueService $value,
        private readonly SatisfactionService $satisfaction,
        private readonly ServicePerformanceService $service,
        private readonly SalesPerformanceService $sales,
        private readonly LoyaltyPerformanceService $loyalty,
    ) {}

    /** @return array<string, mixed> */
    public function overview(string $companyId, ExecutivePeriod $period): array
    {
        $kpis = $this->kpis->forPeriod($companyId, $period);
        $retention = $this->retention->forCompany($companyId);
        $value = $this->value->forCompany($companyId);
        $satisfaction = $this->satisfaction->forPeriod($companyId, $period);
        $service = $this->service->forPeriod($companyId, $period);
        $sales = $this->sales->forPeriod($companyId, $period);
        $loyalty = $this->loyalty->forPeriod($companyId, $period);

        return [
            'period' => $period->toArray(),
            'comparison_period' => $period->previous()->toArray(),
            'headline' => $this->headline($kpis, $retention, $value, $satisfaction, $service, $sales, $period, $companyId),
            'customers' => $kpis,
            'growth' => $this->growth->forPeriod($companyId, $period),
            'retention' => $retention,
            'lifetime_value' => $value,
            'satisfaction' => $satisfaction,
            'service' => $service,
            'sales' => $sales,
            'loyalty' => $loyalty,
        ];
    }

    /**
     * The numbers an executive reads first — one row of the whole business.
     *
     * @return array<string, mixed>
     */
    private function headline(
        array $kpis,
        array $retention,
        array $value,
        array $satisfaction,
        array $service,
        array $sales,
        ExecutivePeriod $period,
        string $companyId,
    ): array {
        return [
            'total_customers' => $kpis['total_customers'],
            'new_customers' => $kpis['new_customers']['value'],
            'new_customers_trend' => $kpis['new_customers']['trend'],
            'revenue_in_period' => $this->value->revenueBetween($companyId, $period->start, $period->end),
            'total_lifetime_value' => $value['total_lifetime_value'],
            'retention_rate_percent' => $retention['retention_rate_percent'],
            'churn_rate_percent' => $retention['churn_rate_percent'],
            'at_risk_customers' => $retention['at_risk_customers'],
            'csat_percent' => $satisfaction['csat_percent']['value'],
            'nps' => $satisfaction['nps']['value'],
            'open_tickets' => $service['open_tickets'],
            'sla_attainment_percent' => $service['sla']['resolution_attainment_percent'],
            'sla_target_percent' => ExecutiveThresholds::SLA_TARGET_PERCENT,
            'win_rate_percent' => $sales['opportunities']['win_rate_percent'],
            'weighted_pipeline_value' => $sales['opportunities']['weighted_pipeline_value'],
        ];
    }
}
