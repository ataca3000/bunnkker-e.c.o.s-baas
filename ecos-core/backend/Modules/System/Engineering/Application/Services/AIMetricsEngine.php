<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Application\Services;

use Modules\System\Engineering\Domain\Models\EngineeringAIMetric;

class AIMetricsEngine
{
    public function record(string $companyId, string $type, string $key, float $value, array $dimensions = []): void
    {
        EngineeringAIMetric::create([
            'company_id'   => $companyId,
            'metric_type'  => $type,
            'metric_key'   => $key,
            'metric_value' => $value,
            'dimensions'   => $dimensions ?: null,
        ]);
    }

    public function getLatest(string $companyId, string $type, string $key): ?EngineeringAIMetric
    {
        return EngineeringAIMetric::where('company_id', $companyId)
            ->where('metric_type', $type)
            ->where('metric_key', $key)
            ->latest('id')->first();
    }

    public function getTimeseries(string $companyId, string $type, string $key, int $limit = 50): array
    {
        return EngineeringAIMetric::where('company_id', $companyId)
            ->where('metric_type', $type)
            ->where('metric_key', $key)
            ->orderByDesc('id')->limit($limit)
            ->get()->reverse()->values()->toArray();
    }

    public function getAggregates(string $companyId): array
    {
        return EngineeringAIMetric::where('company_id', $companyId)
            ->selectRaw('metric_type, metric_key, AVG(metric_value) as avg, MAX(metric_value) as max, MIN(metric_value) as min, COUNT(*) as data_points')
            ->groupBy('metric_type', 'metric_key')
            ->get()->toArray();
    }
}
