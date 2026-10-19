<?php

declare(strict_types=1);

namespace Modules\Marketing\Automation\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Marketing\Automation\Application\Services\AutomationGovernanceService;
use Modules\Marketing\Automation\Domain\Models\AutomationGovernancePolicy;
use Modules\Marketing\Automation\Presentation\Http\Resources\GovernancePolicyResource;

class AutomationGovernanceController extends Controller
{
    public function __construct(private readonly AutomationGovernanceService $service) {}

    public function index(Request $request): JsonResponse
    {
        $policies = $this->service->list($request->only(['company_id']));

        return response()->json(GovernancePolicyResource::collection($policies)->response()->getData(true));
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'company_id' => 'nullable|uuid',
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'max_executions_per_customer_per_day' => 'nullable|integer|min:1',
            'max_executions_per_customer_per_workflow' => 'nullable|integer|min:1',
            'max_total_executions_per_day' => 'nullable|integer|min:1',
            'quiet_hours_start' => 'nullable|date_format:H:i',
            'quiet_hours_end' => 'nullable|date_format:H:i',
            'quiet_hours_timezone' => 'nullable|string',
            'blacklisted_channels' => 'nullable|array',
            'opt_out_rules' => 'nullable|array',
            'allowed_action_types' => 'nullable|array',
            'requires_approval' => 'boolean',
            'is_default' => 'boolean',
        ]);

        $policy = $this->service->create($validated, (string) $request->user()->id);

        return response()->json(new GovernancePolicyResource($policy), 201);
    }

    public function show(AutomationGovernancePolicy $policy): JsonResponse
    {
        return response()->json(new GovernancePolicyResource($policy));
    }

    public function update(Request $request, AutomationGovernancePolicy $policy): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'max_executions_per_customer_per_day' => 'nullable|integer|min:1',
            'max_executions_per_customer_per_workflow' => 'nullable|integer|min:1',
            'max_total_executions_per_day' => 'nullable|integer|min:1',
            'quiet_hours_start' => 'nullable|date_format:H:i',
            'quiet_hours_end' => 'nullable|date_format:H:i',
            'quiet_hours_timezone' => 'nullable|string',
            'blacklisted_channels' => 'nullable|array',
            'requires_approval' => 'boolean',
            'is_default' => 'boolean',
        ]);

        $policy = $this->service->update($policy, $validated, (string) $request->user()->id);

        return response()->json(new GovernancePolicyResource($policy));
    }

    public function destroy(AutomationGovernancePolicy $policy): JsonResponse
    {
        $this->service->delete($policy);

        return response()->json(null, 204);
    }
}
