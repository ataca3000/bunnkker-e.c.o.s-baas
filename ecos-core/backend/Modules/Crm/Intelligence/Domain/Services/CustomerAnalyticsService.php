<?php

declare(strict_types=1);

namespace Modules\Crm\Intelligence\Domain\Services;

use Illuminate\Support\Facades\DB;
use Modules\Crm\Intelligence\Domain\Enums\ChurnRiskBand;
use Modules\Crm\Intelligence\Domain\Enums\HealthBand;
use Modules\Crm\Intelligence\Domain\Enums\LifecycleStage;

/**
 * Portfolio-level customer analytics — deterministic aggregation over the
 * intelligence profiles. Distributions, totals and averages, all counted.
 */
final class CustomerAnalyticsService
{
    public function __construct(
        private readonly SegmentationService $segmentation,
        private readonly RetentionIndicatorService $retention,
    ) {}

    /** @return array<string, mixed> */
    public function overview(string $companyId): array
    {
        $base = fn () => DB::table('crm_customer_intelligence_profiles')->where('company_id', $companyId);

        $total = $base()->count();

        return [
            'customers' => $total,
            'total_lifetime_value' => round((float) $base()->sum('lifetime_value'), 2),
            'predicted_lifetime_value' => round((float) $base()->sum('predicted_lifetime_value'), 2),
            'average_health_score' => $total > 0 ? round((float) $base()->avg('health_score'), 1) : 0.0,
            'average_churn_risk' => $total > 0 ? round((float) $base()->avg('churn_risk_score'), 1) : 0.0,
            'segments' => $this->segmentation->distribution($companyId),
            'health_bands' => $this->bandCounts($companyId, 'health_band', HealthBand::cases()),
            'churn_bands' => $this->bandCounts($companyId, 'churn_risk_band', ChurnRiskBand::cases()),
            'lifecycle_stages' => $this->bandCounts($companyId, 'lifecycle_stage', LifecycleStage::cases()),
            'retention' => $this->retention->forCompany($companyId),
        ];
    }

    /**
     * @param  array<int, \BackedEnum>  $cases
     * @return array<int, array<string, mixed>>
     */
    private function bandCounts(string $companyId, string $column, array $cases): array
    {
        $counts = DB::table('crm_customer_intelligence_profiles')
            ->where('company_id', $companyId)
            ->groupBy($column)
            ->selectRaw("{$column} as band, count(*) as total")
            ->pluck('total', 'band');

        return collect($cases)->map(fn ($case) => [
            'key' => $case->value,
            'customers' => (int) ($counts[$case->value] ?? 0),
        ])->all();
    }
}
