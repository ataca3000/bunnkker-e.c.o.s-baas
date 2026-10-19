<?php

declare(strict_types=1);

namespace Modules\Marketing\Automation\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Marketing\Automation\Application\Services\WorkflowExecutionEngine;
use Modules\Marketing\Automation\Domain\Models\AutomationWorkflow;
use Modules\Marketing\Automation\Domain\Models\WorkflowExecution;
use Modules\Marketing\Automation\Presentation\Http\Resources\WorkflowExecutionResource;

class WorkflowExecutionController extends Controller
{
    public function __construct(private readonly WorkflowExecutionEngine $engine) {}

    public function index(Request $request, AutomationWorkflow $workflow): JsonResponse
    {
        $executions = $workflow->executions()
            ->when($request->get('status'), fn ($q, $v) => $q->where('status', $v))
            ->orderByDesc('created_at')
            ->paginate((int) $request->get('per_page', 25));

        return response()->json(WorkflowExecutionResource::collection($executions)->response()->getData(true));
    }

    public function show(AutomationWorkflow $workflow, WorkflowExecution $execution): JsonResponse
    {
        if ($execution->workflow_id !== $workflow->id) {
            abort(404);
        }

        $execution->load('steps');

        return response()->json(new WorkflowExecutionResource($execution));
    }

    public function cancel(Request $request, AutomationWorkflow $workflow, WorkflowExecution $execution): JsonResponse
    {
        if ($execution->workflow_id !== $workflow->id) {
            abort(404);
        }

        $this->engine->cancel($execution);

        return response()->json(new WorkflowExecutionResource($execution->fresh()));
    }

    public function retry(Request $request, AutomationWorkflow $workflow, WorkflowExecution $execution): JsonResponse
    {
        if ($execution->workflow_id !== $workflow->id) {
            abort(404);
        }

        $execution = $this->engine->retry($execution, (string) $request->user()->id);

        return response()->json(new WorkflowExecutionResource($execution));
    }

    public function stats(AutomationWorkflow $workflow): JsonResponse
    {
        return response()->json($this->engine->getExecutionStats($workflow));
    }
}
