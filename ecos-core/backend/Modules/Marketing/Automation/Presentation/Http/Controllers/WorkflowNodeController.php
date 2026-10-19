<?php

declare(strict_types=1);

namespace Modules\Marketing\Automation\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Marketing\Automation\Application\Services\WorkflowService;
use Modules\Marketing\Automation\Domain\Models\AutomationWorkflow;
use Modules\Marketing\Automation\Presentation\Http\Resources\WorkflowResource;

class WorkflowNodeController extends Controller
{
    public function __construct(private readonly WorkflowService $service) {}

    /** PUT /workflows/{workflow}/canvas — replace the entire nodes_graph (canvas save) */
    public function update(Request $request, AutomationWorkflow $workflow): JsonResponse
    {
        $validated = $request->validate([
            'nodes_graph' => 'required|array',
            'nodes_graph.nodes' => 'required|array',
            'nodes_graph.edges' => 'required|array',
        ]);

        $workflow = $this->service->updateNodesGraph($workflow, $validated['nodes_graph'], (string) $request->user()->id);

        return response()->json(new WorkflowResource($workflow));
    }
}
