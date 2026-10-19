<?php

declare(strict_types=1);

namespace Modules\Marketing\Automation\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Marketing\Automation\Application\Actions\TriggerWorkflowAction;
use Modules\Marketing\Automation\Domain\Models\AutomationWorkflow;
use Modules\Marketing\Automation\Presentation\Http\Resources\WorkflowExecutionResource;

class WorkflowTriggerController extends Controller
{
    public function __construct(private readonly TriggerWorkflowAction $triggerAction) {}

    /** POST /workflows/{workflow}/trigger — manually trigger a workflow */
    public function trigger(Request $request, AutomationWorkflow $workflow): JsonResponse
    {
        $validated = $request->validate([
            'entity_type' => 'required|string',
            'entity_id' => 'required|string',
            'payload' => 'nullable|array',
        ]);

        $execution = $this->triggerAction->execute(
            workflow: $workflow,
            entityType: $validated['entity_type'],
            entityId: $validated['entity_id'],
            triggerType: 'manual',
            payload: $validated['payload'] ?? [],
            triggeredBy: (string) $request->user()->id,
        );

        return response()->json(new WorkflowExecutionResource($execution), 201);
    }

    /** POST /automation/webhook/{workflow} — public webhook endpoint (no auth guard) */
    public function webhook(Request $request, AutomationWorkflow $workflow): JsonResponse
    {
        $execution = $this->triggerAction->execute(
            workflow: $workflow,
            entityType: $request->get('entity_type', 'webhook'),
            entityId: $request->get('entity_id', 'webhook'),
            triggerType: 'webhook',
            payload: $request->all(),
            triggeredBy: null,
        );

        return response()->json(['execution_id' => $execution->id], 202);
    }
}
