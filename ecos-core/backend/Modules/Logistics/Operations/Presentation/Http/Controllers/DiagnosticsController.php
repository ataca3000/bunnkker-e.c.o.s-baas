<?php

declare(strict_types=1);

namespace Modules\Logistics\Operations\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Logistics\Operations\Domain\Services\DiagnosticsService;

/**
 * The Diagnostics Center — read-only projections of system health.
 */
class DiagnosticsController extends Controller
{
    public function __construct(
        private readonly DiagnosticsService $diagnostics,
    ) {}

    public function center(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->diagnostics->center($this->companyId($request))]);
    }

    public function system(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->diagnostics->systemHealth($this->companyId($request))]);
    }

    public function dependencies(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->diagnostics->dependencyHealth($this->companyId($request))]);
    }

    public function queue(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->diagnostics->queueHealth($this->companyId($request))]);
    }

    public function capacity(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->diagnostics->capacityHealth($this->companyId($request))]);
    }

    public function dispatch(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->diagnostics->dispatchHealth($this->companyId($request))]);
    }

    public function exceptions(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->diagnostics->exceptionHealth($this->companyId($request))]);
    }

    private function companyId(Request $request): ?string
    {
        $companyId = $request->user()?->company_id;

        return $companyId === null ? null : (string) $companyId;
    }
}
