<?php

declare(strict_types=1);

namespace Modules\Logistics\Operations\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Logistics\Operations\Domain\Services\CrossModuleValidationService;
use Modules\Logistics\Operations\Domain\Services\ReadinessValidationService;

/**
 * Enterprise readiness and cross-module validation.
 *
 * Read-only. Every figure is the owning module's, interpreted into a readiness
 * verdict — nothing here computes readiness or capacity itself.
 */
class ReadinessController extends Controller
{
    public function __construct(
        private readonly ReadinessValidationService $readiness,
        private readonly CrossModuleValidationService $validation,
    ) {}

    // ── A. Operational readiness ─────────────────────────────────────────────

    public function dashboard(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->readiness->dashboard($this->companyId($request))]);
    }

    public function healthScore(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->readiness->healthScore($this->companyId($request))]);
    }

    public function modules(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->readiness->moduleSummary($this->companyId($request))]);
    }

    public function checklist(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->readiness->checklist($this->companyId($request))]);
    }

    // ── B. Cross-module validation ───────────────────────────────────────────

    /** The unified validation report across every authority. */
    public function validateAll(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->validation->report($this->companyId($request))]);
    }

    /** One authority: fleet | drivers | capacity | dispatch | operations. */
    public function validateModule(Request $request, string $module): JsonResponse
    {
        $result = $this->validation->validate($module, $this->companyId($request));

        if ($result === null) {
            return response()->json(['message' => "Unknown module '{$module}'."], 404);
        }

        return response()->json(['data' => $result]);
    }

    private function companyId(Request $request): ?string
    {
        $companyId = $request->user()?->company_id;

        return $companyId === null ? null : (string) $companyId;
    }
}
