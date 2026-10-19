<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\CustomerEngagement\Application\Services\DashboardService;
use Modules\CustomerEngagement\Application\Services\UnifiedInboxService;

class DashboardController extends Controller
{
    public function __construct(
        private readonly DashboardService $dashboardService,
        private readonly UnifiedInboxService $inboxService,
    ) {}

    public function kpis(Request $request): JsonResponse
    {
        $data = $this->dashboardService->getKpis($request->company_id);

        return response()->json(['data' => $data]);
    }

    public function agentPerformance(Request $request): JsonResponse
    {
        $data = $this->dashboardService->getAgentPerformance($request->company_id);

        return response()->json(['data' => $data]);
    }

    public function providerDistribution(Request $request): JsonResponse
    {
        $data = $this->dashboardService->getProviderDistribution($request->company_id);

        return response()->json(['data' => $data]);
    }

    public function statusDistribution(Request $request): JsonResponse
    {
        $data = $this->dashboardService->getStatusDistribution($request->company_id);

        return response()->json(['data' => $data]);
    }

    public function unreadCount(Request $request): JsonResponse
    {
        $count = $this->inboxService->getUnreadCount($request->company_id);

        return response()->json(['count' => $count]);
    }
}
