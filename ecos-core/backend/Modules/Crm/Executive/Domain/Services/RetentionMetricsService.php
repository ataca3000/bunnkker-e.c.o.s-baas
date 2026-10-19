<?php

declare(strict_types=1);

namespace Modules\Crm\Executive\Domain\Services;

use Illuminate\Support\Facades\DB;
use Modules\Crm\Executive\Domain\Support\Metric;

/**
 * Retention and churn — read straight off the C5 intelligence profiles.
 *
 * C5 already computes retention and churn deterministically per customer; the
 * executive layer only counts and rates them. It does not re-derive the model,
 * so the boardroom number and the account manager's number always agree.
 */
final class RetentionMetricsService
{
    /** @return array<string, mixed> */
    public function forCompany(string $companyId): array
    {
        $profiles = DB::table('crm_customer_intelligence_profiles')->where('company_id', $companyId);

        $total = (clone $profiles)->count();
        if ($total === 0) {
            return $this->empty();
        }

        $repeat = (clone $profiles)->where('is_repeat', true)->count();
        $retained = (clone $profiles)->where('is_retained', true)->count();
        $single = (clone $profiles)->where('frequency', 1)->count();

        $churnBands = (clone $profiles)
            ->groupBy('churn_risk_band')
            ->selectRaw('churn_risk_band as band, count(*) as total')
            ->pluck('total', 'band');

        $atRisk = (int) ($churnBands['high'] ?? 0) + (int) ($churnBands['critical'] ?? 0);

        return [
            'customers_analysed' => $total,
            'retention_rate_percent' => Metric::rate($retained, $total),
            'churn_rate_percent' => Metric::rate($total - $retained, $total),
            'repeat_purchase_rate_percent' => Metric::rate($repeat, $total),
            'repeat_customers' => $repeat,
            'single_purchase_customers' => $single,
            'at_risk_customers' => $atRisk,
            'at_risk_rate_percent' => Metric::rate($atRisk, $total),
            'churn_bands' => $churnBands->map(fn ($v) => (int) $v)->all(),
            'average_churn_score' => round((float) (clone $profiles)->avg('churn_risk_score'), 1),
        ];
    }

    /** @return array<string, mixed> */
    private function empty(): array
    {
        return [
            'customers_analysed' => 0,
            'retention_rate_percent' => 0.0,
            'churn_rate_percent' => 0.0,
            'repeat_purchase_rate_percent' => 0.0,
            'repeat_customers' => 0,
            'single_purchase_customers' => 0,
            'at_risk_customers' => 0,
            'at_risk_rate_percent' => 0.0,
            'churn_bands' => [],
            'average_churn_score' => 0.0,
        ];
    }
}
