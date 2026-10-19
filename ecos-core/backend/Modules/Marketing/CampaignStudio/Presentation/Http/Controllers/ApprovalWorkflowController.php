<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Marketing\CampaignStudio\Domain\Models\ApprovalWorkflowTemplate;
use Modules\Marketing\CampaignStudio\Presentation\Http\Resources\ApprovalWorkflowResource;

class ApprovalWorkflowController extends Controller
{
    /** GET /mkt/studio/workflows */
    public function index(Request $request): JsonResponse
    {
        $workflows = ApprovalWorkflowTemplate::with('steps')
            ->where('is_active', true)
            ->when($request->query('company_id'), fn ($q, $id) => $q->where(fn ($q) => $q->where('company_id', $id)->orWhereNull('company_id')))
            ->orderByDesc('is_default')
            ->orderBy('name')
            ->paginate((int) $request->query('per_page', 25));

        return response()->json([
            'data' => ApprovalWorkflowResource::collection($workflows->items())->resolve(),
            'meta' => [
                'current_page' => $workflows->currentPage(),
                'last_page' => $workflows->lastPage(),
                'per_page' => $workflows->perPage(),
                'total' => $workflows->total(),
            ],
        ]);
    }

    /** POST /mkt/studio/workflows */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'company_id' => ['nullable', 'string'],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'is_default' => ['sometimes', 'boolean'],
            'steps' => ['required', 'array', 'min:1'],
            'steps.*.step_name' => ['required', 'string', 'max:255'],
            'steps.*.step_order' => ['required', 'integer', 'min:1'],
            'steps.*.role_required' => ['nullable', 'string', 'max:100'],
            'steps.*.user_id_required' => ['nullable', 'string', 'max:36'],
            'steps.*.is_optional' => ['sometimes', 'boolean'],
            'steps.*.timeout_hours' => ['nullable', 'integer', 'min:1'],
            'steps.*.on_timeout_action' => ['sometimes', 'in:escalate,auto_approve,reject'],
        ]);

        $workflow = ApprovalWorkflowTemplate::create([
            'company_id' => $validated['company_id'] ?? null,
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'is_default' => $validated['is_default'] ?? false,
            'created_by' => (string) $request->user()->id,
            'updated_by' => (string) $request->user()->id,
        ]);

        foreach ($validated['steps'] as $step) {
            $workflow->steps()->create($step);
        }

        return response()->json(['data' => new ApprovalWorkflowResource($workflow->load('steps'))], 201);
    }

    /** GET /mkt/studio/workflows/{workflow} */
    public function show(ApprovalWorkflowTemplate $workflow): JsonResponse
    {
        return response()->json(['data' => new ApprovalWorkflowResource($workflow->load('steps'))]);
    }

    /** PUT /mkt/studio/workflows/{workflow} */
    public function update(Request $request, ApprovalWorkflowTemplate $workflow): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string'],
            'is_default' => ['sometimes', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $workflow->update(array_merge($validated, ['updated_by' => (string) $request->user()->id]));

        return response()->json(['data' => new ApprovalWorkflowResource($workflow->fresh()->load('steps'))]);
    }

    /** DELETE /mkt/studio/workflows/{workflow} */
    public function destroy(ApprovalWorkflowTemplate $workflow): JsonResponse
    {
        $workflow->update(['is_active' => false]);

        return response()->json(null, 204);
    }
}
