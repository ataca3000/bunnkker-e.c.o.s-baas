<?php

declare(strict_types=1);

namespace Modules\Finance\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Finance\Intelligence\Domain\Services\CashFlowIntelligenceService;
use Modules\Finance\Presentation\Http\Controllers\Concerns\ResolvesFinanceContext;

/** Cash-flow intelligence — current, forecasts, liquidity and risk. */
class CashFlowController extends Controller
{
    use ResolvesFinanceContext;

    public function __construct(private readonly CashFlowIntelligenceService $service) {}

    public function current(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->service->current($this->companyId($request))]);
    }

    public function forecast(Request $request): JsonResponse
    {
        $company = $this->companyId($request);
        $horizon = (int) $request->integer('horizon', 3);

        return response()->json(['data' => [
            'liquidity_projection' => $this->service->liquidityProjection($company, $horizon),
            'receivable_forecast' => $this->service->receivableForecast($company),
            'payable_forecast' => $this->service->payableForecast($company),
            'risk_alerts' => $this->service->riskAlerts($company, $horizon),
        ]]);
    }
}
