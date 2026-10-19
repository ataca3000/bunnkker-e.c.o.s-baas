<?php

declare(strict_types=1);

namespace Modules\Finance\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Finance\Budget\Domain\Models\Budget;
use Modules\Finance\Intelligence\Domain\Services\CashFlowIntelligenceService;
use Modules\Finance\Intelligence\Domain\Services\ForecastService;
use Modules\Finance\Intelligence\Domain\Services\TrendAnalysisService;
use Modules\Finance\Intelligence\Domain\Services\VarianceAnalysisService;
use Modules\Finance\Presentation\Http\Controllers\Concerns\ResolvesFinanceContext;

/**
 * Financial Intelligence — deterministic, explainable trends, forecasts,
 * variance and risk. Read-only; no generative AI.
 */
class FinancialIntelligenceController extends Controller
{
    use ResolvesFinanceContext;

    public function __construct(
        private readonly TrendAnalysisService $trends,
        private readonly ForecastService $forecast,
        private readonly CashFlowIntelligenceService $cashFlow,
        private readonly VarianceAnalysisService $variance,
    ) {}

    public function trends(Request $request): JsonResponse
    {
        $company = $this->companyId($request);
        $months = (int) $request->integer('months', 12);

        return response()->json(['data' => [
            'revenue' => $this->trends->revenue($company, $months),
            'expense' => $this->trends->expense($company, $months),
            'profit' => $this->trends->profit($company, $months),
            'margin' => $this->trends->margin($company, $months),
        ]]);
    }

    public function forecasts(Request $request): JsonResponse
    {
        $company = $this->companyId($request);
        $horizon = (int) $request->integer('horizon', 3);

        return response()->json(['data' => [
            'cash_flow' => $this->cashFlow->liquidityProjection($company, $horizon),
            'revenue' => $this->forecast->revenueForecast($company, 12, $horizon),
            'expense' => $this->forecast->expenseForecast($company, 12, $horizon),
            'profitability' => $this->forecast->profitabilityForecast($company, 12, $horizon),
        ]]);
    }

    public function risk(Request $request): JsonResponse
    {
        return response()->json(['data' => ['alerts' => $this->cashFlow->riskAlerts($this->companyId($request))]]);
    }

    public function variance(Request $request, string $budgetUuid): JsonResponse
    {
        $budget = Budget::query()->where('company_id', $this->companyId($request))->where('uuid', $budgetUuid)->firstOrFail();

        return response()->json(['data' => $this->variance->forBudget($budget)]);
    }
}
