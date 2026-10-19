<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\System\Engineering\Application\Services\ResourceManager;
use Modules\System\Traits\HasApiResponse;

final class ClusterMetricsController
{
    use HasApiResponse;

    public function __construct(private readonly ResourceManager $resourceManager) {}

    public function snapshot(Request $request): JsonResponse
    {
        $snapshot = $this->resourceManager->collectSnapshot(auth()->user()->company_id);
        return $this->success(['snapshot' => $snapshot]);
    }

    public function trend(Request $request): JsonResponse
    {
        $trend = $this->resourceManager->getTrend(auth()->user()->company_id, (int) $request->get('limit', 60));
        return $this->success(['trend' => $trend]);
    }

    public function timeseries(Request $request): JsonResponse
    {
        $data = $request->validate(['metric_type' => 'required|string', 'minutes' => 'nullable|integer|min:1|max:1440']);
        $series = $this->resourceManager->getMetricTimeseries(auth()->user()->company_id, $data['metric_type'], $data['minutes'] ?? 60);
        return $this->success(['series' => $series, 'metric_type' => $data['metric_type']]);
    }

    public function purge(Request $request): JsonResponse
    {
        $count = $this->resourceManager->purgeOldRecords(auth()->user()->company_id, (int) $request->get('days', 30));
        return $this->success(['purged' => $count, 'message' => "Purged {$count} old metric records"]);
    }
}
