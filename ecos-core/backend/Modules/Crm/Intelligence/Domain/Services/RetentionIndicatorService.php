<?php

declare(strict_types=1);

namespace Modules\Crm\Intelligence\Domain\Services;

use Illuminate\Support\Facades\DB;

/**
 * Retention indicators — portfolio-level, all derived from stored profiles.
 *
 * Repeat-purchase rate, active rate and at-risk share are simple counting ratios
 * over the intelligence profiles; nothing here is inferred, only counted.
 */
final class RetentionIndicatorService
{
    /** @return array<string, mixed> */
    public function forCompany(string $companyId): array
    {
        $base = DB::table('crm_customer_intelligence_profiles')->where('company_id', $companyId);

        $total = (clone $base)->count();
        if ($total === 0) {
            return [
                'customers' => 0, 'repeat_customers' => 0, 'repeat_purchase_rate' => 0.0,
                'retained_customers' => 0, 'retention_rate' => 0.0,
                'at_risk_customers' => 0, 'at_risk_rate' => 0.0,
                'single_purchase_customers' => 0,
            ];
        }

        $repeat = (clone $base)->where('is_repeat', true)->count();
        $retained = (clone $base)->where('is_retained', true)->count();
        $atRisk = (clone $base)->whereIn('churn_risk_band', ['high', 'critical'])->count();
        $single = (clone $base)->where('frequency', 1)->count();

        return [
            'customers' => $total,
            'repeat_customers' => $repeat,
            'repeat_purchase_rate' => round($repeat / $total, 4),
            'retained_customers' => $retained,
            'retention_rate' => round($retained / $total, 4),
            'at_risk_customers' => $atRisk,
            'at_risk_rate' => round($atRisk / $total, 4),
            'single_purchase_customers' => $single,
        ];
    }
}
