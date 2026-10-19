<?php

namespace Modules\System\Engineering\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Core\Http\Traits\HasApiResponse;
use Modules\System\Engineering\Application\Services\IntelAnalyticsEngine;
use Modules\System\Engineering\Application\Services\IntelDebtAnalyzer;
use Modules\System\Engineering\Application\Services\IntelTrendEngine;

class IntelAnalyticsController
{
    use HasApiResponse;

    public function __construct(
        private readonly IntelAnalyticsEngine $analytics,
        private readonly IntelTrendEngine $trends,
        private readonly IntelDebtAnalyzer $debt,
    ) {}

    public function overview(Request $request): JsonResponse
    {
        $days = (int) $request->query('days', '30');

        return $this->success($this->analytics->overview(auth()->user()->company_id, max(1, min(365, $days))));
    }

    public function validators(Request $request): JsonResponse
    {
        $days = (int) $request->query('days', '90');

        return $this->success($this->analytics->validatorReliability(auth()->user()->company_id, max(1, min(365, $days))));
    }

    public function trends(Request $request): JsonResponse
    {
        $days = (int) $request->query('days', '30');

        return $this->success($this->trends->qualityTrend(auth()->user()->company_id, max(2, min(365, $days))));
    }

    public function comparePeriods(Request $request): JsonResponse
    {
        $days = (int) $request->query('days', '7');

        return $this->success($this->trends->comparePeriods(auth()->user()->company_id, max(1, min(90, $days))));
    }

    public function compareReleases(Request $request): JsonResponse
    {
        $data = $request->validate([
            'release_a' => 'required|uuid',
            'release_b' => 'required|uuid',
        ]);

        return $this->success($this->trends->compareReleases(
            auth()->user()->company_id,
            $data['release_a'],
            $data['release_b'],
        ));
    }

    public function debt(): JsonResponse
    {
        return $this->success($this->debt->analyze(auth()->user()->company_id));
    }

    public function snapshot(Request $request): JsonResponse
    {
        $data = $request->validate([
            'snapshot_type' => 'required|in:daily,weekly',
            'period_label'  => 'required|string|max:32',
        ]);

        return $this->success($this->analytics->snapshot(
            auth()->user()->company_id,
            $data['snapshot_type'],
            $data['period_label'],
        ), 201);
    }

    public function snapshots(Request $request): JsonResponse
    {
        $type = (string) $request->query('snapshot_type', 'daily');

        abort_unless(in_array($type, ['daily', 'weekly'], true), 422, 'snapshot_type must be daily or weekly');

        return $this->success($this->analytics->snapshots(auth()->user()->company_id, $type));
    }
}
