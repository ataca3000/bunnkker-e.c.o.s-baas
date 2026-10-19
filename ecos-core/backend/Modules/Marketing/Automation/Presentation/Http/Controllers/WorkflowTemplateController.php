<?php

declare(strict_types=1);

namespace Modules\Marketing\Automation\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Marketing\Automation\Application\Actions\CreateWorkflowFromTemplateAction;
use Modules\Marketing\Automation\Application\Services\WorkflowTemplateService;
use Modules\Marketing\Automation\Domain\Models\AutomationWorkflowTemplate;
use Modules\Marketing\Automation\Presentation\Http\Resources\WorkflowResource;
use Modules\Marketing\Automation\Presentation\Http\Resources\WorkflowTemplateResource;

class WorkflowTemplateController extends Controller
{
    public function __construct(
        private readonly WorkflowTemplateService $service,
        private readonly CreateWorkflowFromTemplateAction $createAction,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $templates = $this->service->list($request->only(['company_id', 'category', 'search']));

        return response()->json(WorkflowTemplateResource::collection($templates)->response()->getData(true));
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'category' => 'required|string',
            'trigger_type' => 'required|string',
            'nodes_graph' => 'required|array',
            'company_id' => 'nullable|uuid',
            'is_global' => 'boolean',
        ]);

        $template = $this->service->create($validated, (string) $request->user()->id);

        return response()->json(new WorkflowTemplateResource($template), 201);
    }

    public function show(AutomationWorkflowTemplate $template): JsonResponse
    {
        return response()->json(new WorkflowTemplateResource($template));
    }

    public function update(Request $request, AutomationWorkflowTemplate $template): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'nodes_graph' => 'sometimes|array',
            'is_active' => 'boolean',
        ]);

        $template = $this->service->update($template, $validated, (string) $request->user()->id);

        return response()->json(new WorkflowTemplateResource($template));
    }

    public function destroy(AutomationWorkflowTemplate $template): JsonResponse
    {
        $this->service->delete($template);

        return response()->json(null, 204);
    }

    public function createWorkflow(Request $request, AutomationWorkflowTemplate $template): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'nullable|string|max:255',
            'company_id' => 'nullable|uuid',
            'brand_id' => 'nullable|uuid',
        ]);

        $workflow = $this->createAction->execute($template, $validated, (string) $request->user()->id);

        return response()->json(new WorkflowResource($workflow), 201);
    }
}
