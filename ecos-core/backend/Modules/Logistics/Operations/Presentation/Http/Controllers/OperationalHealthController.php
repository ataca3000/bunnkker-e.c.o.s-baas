<?php

declare(strict_types=1);

namespace Modules\Logistics\Operations\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Carbon;
use Modules\Logistics\Operations\Domain\Services\OperationalHealthService;

/**
 * The dashboards.
 *
 * Read-only, every one of them. Nothing on this controller writes anything —
 * acting on a problem means calling the owning module's own endpoint, which is
 * what makes these screens safe to rebuild or drop at any time.
 */
class OperationalHealthController extends Controller
{
    public function __construct(
        private readonly OperationalHealthService $health,
    ) {}

    /** The headline strip. Empty means the operation is healthy. */
    public function overview(Request $request): JsonResponse
    {
        $request->validate(['date' => ['nullable', 'date']]);

        return response()->json([
            'data' => $this->health->overview($this->companyId($request), $this->date($request)),
        ]);
    }

    /** Fleet and Drivers, seen through pool membership. */
    public function resources(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->health->resourceHealth($this->companyId($request))]);
    }

    /** Network's ledger, reported rather than recomputed. */
    public function capacity(Request $request): JsonResponse
    {
        $request->validate(['date' => ['nullable', 'date']]);

        return response()->json([
            'data' => $this->health->capacityHealth($this->companyId($request), $this->date($request)),
        ]);
    }

    /** Phase 3's own numbers, unchanged. */
    public function dispatch(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->health->dispatchHealth($this->companyId($request))]);
    }

    public function utilisation(Request $request): JsonResponse
    {
        $request->validate(['date' => ['nullable', 'date']]);

        return response()->json([
            'data' => $this->health->utilisation($this->companyId($request), $this->date($request)),
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
