<?php

declare(strict_types=1);

namespace Modules\Finance\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Finance\Intelligence\Domain\Services\ProfitabilityService;
use Modules\Finance\Presentation\Http\Controllers\Concerns\ResolvesFinanceContext;

/** Profitability analysis by company, branch, cost center, project and customer. */
class ProfitabilityController extends Controller
{
    use ResolvesFinanceContext;

    public function __construct(private readonly ProfitabilityService $service) {}

    public function company(Request $request): JsonResponse
    {
        [$from, $to] = $this->financeWindow($request);

        return response()->json(['data' => $this->service->company($this->companyId($request), $from, $to)]);
    }

    public function branch(Request $request): JsonResponse
    {
        [$from, $to] = $this->financeWindow($request);

        return response()->json(['data' => $this->service->byBranch($this->companyId($request), $from, $to)]);
    }

    public function costCenter(Request $request): JsonResponse
    {
        [$from, $to] = $this->financeWindow($request);

        return response()->json(['data' => $this->service->byCostCenter($this->companyId($request), $from, $to)]);
    }

    public function project(Request $request): JsonResponse
    {
        [$from, $to] = $this->financeWindow($request);

        return response()->json(['data' => $this->service->byProject($this->companyId($request), $from, $to)]);
    }

    public function customer(Request $request): JsonResponse
    {
        [$from, $to] = $this->financeWindow($request);

        return response()->json(['data' => $this->service->byCustomer($this->companyId($request), $from, $to)]);
    }

    public function product(Request $request): JsonResponse
    {
        [$from, $to] = $this->financeWindow($request);

        return response()->json(['data' => $this->service->byUntaggedDimension($this->companyId($request), 'product', $from, $to)]);
    }

    public function channel(Request $request): JsonResponse
    {
        [$from, $to] = $this->financeWindow($request);

        return response()->json(['data' => $this->service->byUntaggedDimension($this->companyId($request), 'channel', $from, $to)]);
    }
}
