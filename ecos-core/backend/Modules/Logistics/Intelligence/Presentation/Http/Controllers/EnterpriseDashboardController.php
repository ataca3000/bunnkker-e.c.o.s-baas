<?php

declare(strict_types=1);

namespace Modules\Logistics\Intelligence\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Logistics\Intelligence\Domain\Services\EnterpriseDashboardService;

/**
 * The Enterprise Workspace dashboards — one aggregated read each, read-only.
 *
 * Company-scoped from the authenticated user, so a dashboard never surfaces
 * another company's operation.
 */
class EnterpriseDashboardController extends Controller
{
    public function __construct(
        private readonly EnterpriseDashboardService $dashboards,
    ) {}

    public function executive(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->dashboards->executive($this->companyId($request))]);
    }

    public function operations(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->dashboards->operations($this->companyId($request))]);
    }

    private function companyId(Request $request): ?string
    {
        $companyId = $request->user()?->company_id;

        return $companyId === null ? null : (string) $companyId;
    }
}
