<?php

declare(strict_types=1);

namespace Modules\Finance\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Finance\Intelligence\Domain\Services\CostIntelligenceService;
use Modules\Finance\Presentation\Http\Controllers\Concerns\ResolvesFinanceContext;

/** Cost intelligence — breakdown, operational classification and trend. */
class CostIntelligenceController extends Controller
{
    use ResolvesFinanceContext;

    public function __construct(private readonly CostIntelligenceService $service) {}

    public function breakdown(Request $request): JsonResponse
    {
        [$from, $to] = $this->financeWindow($request);

        return response()->json(['data' => $this->service->breakdown($this->companyId($request), $from, $to)]);
    }

    public function operational(Request $request): JsonResponse
    {
        [$from, $to] = $this->financeWindow($request);

        return response()->json(['data' => $this->service->operationalClassification($this->companyId($request), $from, $to)]);
    }

    public function trend(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->service->trend($this->companyId($request), (int) $request->integer('months', 12))]);
    }
}
