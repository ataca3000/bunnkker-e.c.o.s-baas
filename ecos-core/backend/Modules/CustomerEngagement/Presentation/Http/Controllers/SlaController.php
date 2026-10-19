<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\CustomerEngagement\Application\Services\SlaService;
use Modules\CustomerEngagement\Domain\Models\Conversation;
use Modules\CustomerEngagement\Domain\Models\SlaPolicy;
use Modules\CustomerEngagement\Presentation\Http\Resources\SlaPolicyResource;
use Modules\CustomerEngagement\Presentation\Http\Resources\SlaViolationResource;

class SlaController extends Controller
{
    public function __construct(private readonly SlaService $slaService) {}

    public function policies(Request $request): JsonResponse
    {
        $policies = $this->slaService->listPolicies($request->company_id);

        return response()->json(['data' => SlaPolicyResource::collection($policies)]);
    }

    public function storePolicy(Request $request): JsonResponse
    {
        $data = $request->validate([
            'company_id' => 'nullable|uuid',
            'name' => 'required|string|max:100',
            'first_response_minutes' => 'required|integer|min:1',
            'resolution_minutes' => 'required|integer|min:1',
            'business_hours_only' => 'boolean',
            'is_default' => 'boolean',
            'config' => 'nullable|array',
        ]);

        $policy = $this->slaService->createPolicy($data);

        return response()->json(['data' => new SlaPolicyResource($policy)], 201);
    }

    public function updatePolicy(Request $request, SlaPolicy $slaPolicy): JsonResponse
    {
        $data = $request->validate([
            'name' => 'nullable|string|max:100',
            'first_response_minutes' => 'nullable|integer|min:1',
            'resolution_minutes' => 'nullable|integer|min:1',
            'business_hours_only' => 'boolean',
            'is_default' => 'boolean',
            'config' => 'nullable|array',
        ]);

        $slaPolicy->update($data);

        return response()->json(['data' => new SlaPolicyResource($slaPolicy->fresh())]);
    }

    public function violations(Conversation $conversation): JsonResponse
    {
        $violations = $this->slaService->getViolationsForConversation($conversation->id);

        return response()->json(['data' => SlaViolationResource::collection($violations)]);
    }

    public function complianceStats(Request $request): JsonResponse
    {
        $stats = $this->slaService->getComplianceStats($request->company_id);

        return response()->json(['data' => $stats]);
    }

    public function checkBreaches(): JsonResponse
    {
        $count = $this->slaService->checkAndMarkBreaches();

        return response()->json(['breached' => $count]);
    }
}
