<?php

declare(strict_types=1);

namespace Modules\Crm\Executive\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Crm\Executive\Domain\Services\CustomerGrowthService;
use Modules\Crm\Executive\Domain\Services\CustomerKpiService;
use Modules\Crm\Executive\Domain\Services\ExecutiveDashboardService;
use Modules\Crm\Executive\Domain\Services\LifetimeValueService;
use Modules\Crm\Executive\Domain\Services\RetentionMetricsService;
use Modules\Crm\Executive\Domain\Services\SatisfactionService;
use Modules\Crm\Executive\Presentation\Http\Controllers\Concerns\ResolvesExecutivePeriod;

/** The executive dashboard and its individual KPI panels. Read-only. */
class ExecutiveDashboardController extends Controller
{
    use ResolvesExecutivePeriod;

    public function __construct(
        private readonly ExecutiveDashboardService $dashboard,
        private readonly CustomerKpiService $kpis,
        private readonly CustomerGrowthService $growth,
        private readonly RetentionMetricsService $retention,
        private readonly LifetimeValueService $value,
        private readonly SatisfactionService $satisfaction,
    ) {}

    public function overview(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->dashboard->overview($this->companyId($request), $this->period($request))]);
    }

    public function kpis(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->kpis->forPeriod($this->companyId($request), $this->period($request))]);
    }

    public function growth(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->growth->forPeriod($this->companyId($request), $this->period($request))]);
    }

    public function retention(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->retention->forCompany($this->companyId($request))]);
    }

    public function lifetimeValue(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->value->forCompany($this->companyId($request))]);
    }

    public function satisfaction(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->satisfaction->forPeriod($this->companyId($request), $this->period($request))]);
    }
}
