<?php

declare(strict_types=1);

namespace Modules\Crm\Intelligence\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Crm\Customers\Presentation\Http\Controllers\Concerns\ResolvesCustomerContext;
use Modules\Crm\Intelligence\Domain\Services\CustomerAnalyticsService;
use Modules\Crm\Intelligence\Domain\Services\RetentionIndicatorService;

/** Portfolio customer analytics and retention indicators. */
class CustomerAnalyticsController extends Controller
{
    use ResolvesCustomerContext;

    public function __construct(
        private readonly CustomerAnalyticsService $analytics,
        private readonly RetentionIndicatorService $retention,
    ) {}

    public function overview(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->analytics->overview($this->companyId($request))]);
    }

    public function retention(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->retention->forCompany($this->companyId($request))]);
    }
}
