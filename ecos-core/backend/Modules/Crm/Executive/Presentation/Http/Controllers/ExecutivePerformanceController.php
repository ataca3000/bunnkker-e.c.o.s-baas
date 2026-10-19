<?php

declare(strict_types=1);

namespace Modules\Crm\Executive\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Crm\Executive\Domain\Services\LoyaltyPerformanceService;
use Modules\Crm\Executive\Domain\Services\SalesPerformanceService;
use Modules\Crm\Executive\Domain\Services\ServicePerformanceService;
use Modules\Crm\Executive\Presentation\Http\Controllers\Concerns\ResolvesExecutivePeriod;

/** Service desk, sales and loyalty performance panels. Read-only. */
class ExecutivePerformanceController extends Controller
{
    use ResolvesExecutivePeriod;

    public function __construct(
        private readonly ServicePerformanceService $service,
        private readonly SalesPerformanceService $sales,
        private readonly LoyaltyPerformanceService $loyalty,
    ) {}

    public function service(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->service->forPeriod($this->companyId($request), $this->period($request))]);
    }

    public function sales(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->sales->forPeriod($this->companyId($request), $this->period($request))]);
    }

    public function loyalty(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->loyalty->forPeriod($this->companyId($request), $this->period($request))]);
    }
}
