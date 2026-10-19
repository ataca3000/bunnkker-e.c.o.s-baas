<?php

declare(strict_types=1);

namespace Modules\Logistics\Intelligence\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Logistics\Intelligence\Domain\Services\DecisionEngine;

/**
 * The Logistics Decision Engine surface — read-only decision support.
 *
 * Every response is a suggestion backed by figures the owning modules produced.
 * Acting on one means calling that module's own endpoint; nothing here writes.
 */
class DecisionController extends Controller
{
    public function __construct(
        private readonly DecisionEngine $engine,
    ) {}

    public function decide(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->engine->decide($this->companyId($request))]);
    }

    public function recommendations(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->engine->recommendations($this->companyId($request))]);
    }

    public function priorities(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->engine->priorities($this->companyId($request))]);
    }

    public function conflicts(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->engine->conflictRecommendations($this->companyId($request))]);
    }

    private function companyId(Request $request): ?string
    {
        $companyId = $request->user()?->company_id;

        return $companyId === null ? null : (string) $companyId;
    }
}
