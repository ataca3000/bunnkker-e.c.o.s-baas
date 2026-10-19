<?php

declare(strict_types=1);

namespace Modules\Logistics\Intelligence\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Logistics\Intelligence\Domain\Services\InsightService;

/**
 * The AI Recommendation Layer surface — smart suggestions, bottleneck
 * detection, capacity warnings and operational insights. Read-only.
 */
class InsightController extends Controller
{
    public function __construct(
        private readonly InsightService $insights,
    ) {}

    public function suggestions(Request $request): JsonResponse
    {
        $request->validate(['limit' => ['nullable', 'integer', 'min:1', 'max:20']]);

        return response()->json([
            'data' => $this->insights->smartSuggestions(
                $this->companyId($request),
                (int) $request->integer('limit', 5),
            ),
        ]);
    }

    public function bottlenecks(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->insights->bottlenecks($this->companyId($request))]);
    }

    public function warnings(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->insights->capacityWarnings($this->companyId($request))]);
    }

    public function insights(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->insights->operationalInsights($this->companyId($request))]);
    }

    private function companyId(Request $request): ?string
    {
        $companyId = $request->user()?->company_id;

        return $companyId === null ? null : (string) $companyId;
    }
}
