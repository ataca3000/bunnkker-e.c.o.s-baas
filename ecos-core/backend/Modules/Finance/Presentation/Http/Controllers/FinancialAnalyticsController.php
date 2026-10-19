<?php

declare(strict_types=1);

namespace Modules\Finance\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Finance\Analytics\Domain\Services\FinancialDashboardService;
use Modules\Finance\Presentation\Http\Controllers\Concerns\ResolvesFinanceContext;

/** Financial analytics dashboards: revenue, expense, margin, profit, budget, VAT, executive KPI. */
class FinancialAnalyticsController extends Controller
{
    use ResolvesFinanceContext;

    public function __construct(private readonly FinancialDashboardService $service) {}

    public function revenue(Request $request): JsonResponse
    {
        [$from, $to] = $this->financeWindow($request);

        return response()->json(['data' => $this->service->revenue($this->companyId($request), $from, $to)]);
    }

    public function expense(Request $request): JsonResponse
    {
        [$from, $to] = $this->financeWindow($request);

        return response()->json(['data' => $this->service->expense($this->companyId($request), $from, $to)]);
    }

    public function margin(Request $request): JsonResponse
    {
        [$from, $to] = $this->financeWindow($request);

        return response()->json(['data' => $this->service->margin($this->companyId($request), $from, $to)]);
    }

    public function profit(Request $request): JsonResponse
    {
        [$from, $to] = $this->financeWindow($request);

        return response()->json(['data' => $this->service->profit($this->companyId($request), $from, $to)]);
    }

    public function budget(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->service->budget($this->companyId($request))]);
    }

    public function vat(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->service->vat($this->companyId($request))]);
    }

    public function executiveKpis(Request $request): JsonResponse
    {
        [$from, $to] = $this->financeWindow($request);

        return response()->json(['data' => $this->service->executiveKpis($this->companyId($request), $from, $to)]);
    }
}
