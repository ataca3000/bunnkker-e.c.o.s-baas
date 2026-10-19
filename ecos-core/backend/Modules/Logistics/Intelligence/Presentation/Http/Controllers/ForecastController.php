<?php

declare(strict_types=1);

namespace Modules\Logistics\Intelligence\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Logistics\Intelligence\Domain\Services\ForecastService;

/**
 * The Forecasting surface — deterministic projections, read-only.
 *
 * Each result is stamped `method: deterministic_projection`; these are
 * transparent projections, not statistical predictions.
 */
class ForecastController extends Controller
{
    public function __construct(
        private readonly ForecastService $forecasts,
    ) {}

    public function capacity(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->forecasts->capacityForecast($this->companyId($request))]);
    }

    public function dispatch(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->forecasts->dispatchForecast($this->companyId($request))]);
    }

    public function workload(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->forecasts->workloadForecast($this->companyId($request))]);
    }

    private function companyId(Request $request): ?string
    {
        $companyId = $request->user()?->company_id;

        return $companyId === null ? null : (string) $companyId;
    }
}
