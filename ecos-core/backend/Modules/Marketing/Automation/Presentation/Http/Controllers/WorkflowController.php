<?php

declare(strict_types=1);

namespace Modules\Marketing\Automation\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Marketing\Automation\Application\Actions\ActivateWorkflowAction;
use Modules\Marketing\Automation\Application\Actions\ArchiveWorkflowAction;
use Modules\Marketing\Automation\Application\Actions\PauseWorkflowAction;
use Modules\Marketing\Automation\Application\Services\WorkflowService;
use Modules\Marketing\Automation\Domain\Models\AutomationWorkflow;
use Modules\Marketing\Automation\Presentation\Http\Resources\WorkflowResource;

class WorkflowController extends Controller
{
    public function __construct(
        private readonly WorkflowService $service,
        private readonly ActivateWorkflowAction $activateAction,
        private readonly PauseWorkflowAction $pauseAction,
        private readonly ArchiveWorkflowAction $archiveAction,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $filters = array_merge(
            $request->only(['status', 'trigger_type', 'search']),
            ['company_id' => $request->user()?->company_id],
        );

        $workflows = $this->service->list($filters, (int) $request->get('per_page', 25));

        return response()->json(WorkflowResource::collection($workflows)->response()->getData(true));
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'brand_id' => 'nullable|uuid',
            'trigger_type' => 'required|string',
            'nodes_graph' => 'nullable|array',
            'tags' => 'nullable|array',
            'governance_policy_id' => 'nullable|uuid',
            'event_type' => 'nullable|string',
            'entity_type' => 'nullable|string',
        ]);

        $validated['company_id'] = $request->user()?->company_id;

        $workflow = $this->service->create($validated, (string) $request->user()->id);

        return response()->json(new WorkflowResource($workflow), 201);
    }

    public function show(AutomationWorkflow $workflow): JsonResponse
    {
        $workflow->load(['versions', 'executions', 'schedule', 'eventSubscriptions']);

        return response()->json(new WorkflowResource($workflow));
    }

    public function update(Request $request, AutomationWorkflow $workflow): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'tags' => 'nullable|array',
            'governance_policy_id' => 'nullable|uuid',
        ]);

        $workflow = $this->service->update($workflow, $validated, (string) $request->user()->id);

        return response()->json(new WorkflowResource($workflow));
    }

    public function destroy(AutomationWorkflow $workflow): JsonResponse
    {
        $this->service->delete($workflow);

        return response()->json(null, 204);
    }

    public function duplicate(Request $request, AutomationWorkflow $workflow): JsonResponse
    {
        $copy = $this->service->duplicate($workflow, (string) $request->user()->id);

        return response()->json(new WorkflowResource($copy), 201);
    }

    public function activate(Request $request, AutomationWorkflow $workflow): JsonResponse
    {
        $workflow = $this->activateAction->execute($workflow, (string) $request->user()->id);

        return response()->json(new WorkflowResource($workflow));
    }

    public function pause(Request $request, AutomationWorkflow $workflow): JsonResponse
    {
        $workflow = $this->pauseAction->execute($workflow, (string) $request->user()->id);

        return response()->json(new WorkflowResource($workflow));
    }

    public function archive(Request $request, AutomationWorkflow $workflow): JsonResponse
    {
        $workflow = $this->archiveAction->execute($workflow, (string) $request->user()->id);

        return response()->json(new WorkflowResource($workflow));
    }

    public function kpis(Request $request): JsonResponse
    {
        $kpis = $this->service->getKpis(['company_id' => $request->user()?->company_id]);

        return response()->json($kpis);
    }
}
