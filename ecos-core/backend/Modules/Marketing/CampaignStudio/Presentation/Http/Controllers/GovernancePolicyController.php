<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Marketing\CampaignStudio\Application\Services\GovernancePolicyService;
use Modules\Marketing\CampaignStudio\Domain\Models\GovernancePolicy;
use Modules\Marketing\CampaignStudio\Presentation\Http\Resources\GovernancePolicyResource;

class GovernancePolicyController extends Controller
{
    public function __construct(private readonly GovernancePolicyService $policyService) {}

    /** GET /mkt/studio/governance */
    public function index(Request $request): JsonResponse
    {
        $policies = $this->policyService->list(
            $request->only(['company_id']),
            (int) $request->query('per_page', 25),
        );

        return response()->json([
            'data' => GovernancePolicyResource::collection($policies->items())->resolve(),
            'meta' => [
                'current_page' => $policies->currentPage(),
                'last_page' => $policies->lastPage(),
                'per_page' => $policies->perPage(),
                'total' => $policies->total(),
            ],
        ]);
    }

    /** POST /mkt/studio/governance */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'company_id' => ['nullable', 'string'],
            'naming_pattern' => ['nullable', 'string', 'max:500'],
            'naming_example' => ['nullable', 'string'],
            'min_daily_budget' => ['nullable', 'numeric', 'min:0'],
            'max_daily_budget' => ['nullable', 'numeric', 'min:0'],
            'min_lifetime_budget' => ['nullable', 'numeric', 'min:0'],
            'max_lifetime_budget' => ['nullable', 'numeric', 'min:0'],
            'required_utm_params' => ['nullable', 'array'],
            'required_assets' => ['nullable', 'array'],
            'pixel_required' => ['sometimes', 'boolean'],
            'approval_required' => ['sometimes', 'boolean'],
            'publishing_windows' => ['nullable', 'array'],
            'blocked_publishing_days' => ['nullable', 'array'],
            'allowed_objectives' => ['nullable', 'array'],
            'is_default' => ['sometimes', 'boolean'],
        ]);

        $policy = $this->policyService->create($validated, (string) $request->user()->id);

        return response()->json(['data' => new GovernancePolicyResource($policy)], 201);
    }

    /** GET /mkt/studio/governance/{policy} */
    public function show(GovernancePolicy $policy): JsonResponse
    {
        return response()->json(['data' => new GovernancePolicyResource($policy)]);
    }

    /** PUT /mkt/studio/governance/{policy} */
    public function update(Request $request, GovernancePolicy $policy): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string'],
            'min_daily_budget' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'max_daily_budget' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'pixel_required' => ['sometimes', 'boolean'],
            'approval_required' => ['sometimes', 'boolean'],
            'naming_pattern' => ['sometimes', 'nullable', 'string'],
            'is_default' => ['sometimes', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $updated = $this->policyService->update($policy, $validated, (string) $request->user()->id);

        return response()->json(['data' => new GovernancePolicyResource($updated)]);
    }

    /** DELETE /mkt/studio/governance/{policy} */
    public function destroy(GovernancePolicy $policy): JsonResponse
    {
        $this->policyService->delete($policy);

        return response()->json(null, 204);
    }
}
