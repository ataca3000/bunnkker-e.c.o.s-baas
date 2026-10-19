<?php

declare(strict_types=1);

namespace Modules\Logistics\Intelligence\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Logistics\Intelligence\Domain\Services\OptimizationService;

/**
 * The Optimisation Engine surface — read-only, deterministic suggestions.
 */
class OptimizationController extends Controller
{
    public function __construct(
        private readonly OptimizationService $optimisation,
    ) {}

    public function vehicle(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->optimisation->vehicleOptimisation($this->companyId($request))]);
    }

    public function capacity(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->optimisation->capacityOptimisation($this->companyId($request))]);
    }

    public function route(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->optimisation->routeRecommendation($this->companyId($request))]);
    }

    public function assignment(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->optimisation->assignmentRecommendation($this->companyId($request))]);
    }

    private function companyId(Request $request): ?string
    {
        $companyId = $request->user()?->company_id;

        return $companyId === null ? null : (string) $companyId;
    }
}
