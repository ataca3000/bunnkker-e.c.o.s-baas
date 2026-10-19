<?php

declare(strict_types=1);

namespace Modules\Logistics\Operations\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Carbon;
use Modules\Logistics\Operations\Domain\Services\OperationalDashboardService;

/**
 * The five operational dashboards.
 *
 * Read-only, every one. Nothing here writes; acting on what a dashboard shows
 * means calling the owning module's endpoint, which is what keeps these screens
 * safe to rebuild or drop.
 */
class DashboardController extends Controller
{
    public function __construct(
        private readonly OperationalDashboardService $dashboards,
    ) {}

    public function fleet(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->dashboards->fleetUtilisation($this->companyId($request))]);
    }

    public function drivers(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->dashboards->driverUtilisation($this->companyId($request))]);
    }

    public function capacity(Request $request): JsonResponse
    {
        $request->validate(['date' => ['nullable', 'date']]);

        return response()->json([
            'data' => $this->dashboards->capacityUtilisation($this->companyId($request), $this->date($request)),
        ]);
    }

    public function dispatch(Request $request): JsonResponse
    {
        $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        return response()->json([
            'data' => $this->dashboards->dispatchPerformance(
                $this->companyId($request),
                $request->filled('from') ? Carbon::parse($request->string('from')) : null,
                $request->filled('to') ? Carbon::parse($request->string('to')) : null,
            ),
        ]);
    }

    public function kpi(Request $request): JsonResponse
    {
        $request->validate(['date' => ['nullable', 'date']]);

        return response()->json([
            'data' => $this->dashboards->operationalKpis($this->companyId($request), $this->date($request)),
        ]);
    }

    private function date(Request $request): ?Carbon
    {
        return $request->filled('date') ? Carbon::parse($request->string('date')) : null;
    }

    private function companyId(Request $request): ?string
    {
        $companyId = $request->user()?->company_id;

        return $companyId === null ? null : (string) $companyId;
    }
}
