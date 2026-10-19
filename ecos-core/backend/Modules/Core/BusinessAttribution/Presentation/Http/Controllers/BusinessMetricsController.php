<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Core\BusinessAttribution\Application\Services\BusinessMetricsService;
use Modules\Core\BusinessAttribution\Domain\Models\BusinessDna;
use Modules\Core\BusinessAttribution\Presentation\Http\Resources\BusinessMetricResource;

class BusinessMetricsController extends Controller
{
    public function __construct(
        private readonly BusinessMetricsService $metricsService,
    ) {}

    /** Per-DNA metrics (recalculate on demand). */
    public function forDna(BusinessDna $businessDna): JsonResponse
    {
        $metric = $this->metricsService->recalculate($businessDna);

        return response()->json(['data' => new BusinessMetricResource($metric)]);
    }

    /** Aggregate averages across all journeys for a company. */
    public function aggregateAverages(Request $request): JsonResponse
    {
        $companyId = $request->query('company_id');
        $data = $this->metricsService->aggregateAverages($companyId);

        return response()->json(['data' => $data]);
    }
}
