<?php

declare(strict_types=1);

namespace Modules\Marketing\Automation\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Marketing\Automation\Application\Services\WorkflowVersioningService;
use Modules\Marketing\Automation\Domain\Models\AutomationWorkflow;
use Modules\Marketing\Automation\Domain\Models\WorkflowVersion;
use Modules\Marketing\Automation\Presentation\Http\Resources\WorkflowResource;
use Modules\Marketing\Automation\Presentation\Http\Resources\WorkflowVersionResource;

class WorkflowVersionController extends Controller
{
    public function __construct(private readonly WorkflowVersioningService $versioning) {}

    public function index(AutomationWorkflow $workflow): JsonResponse
    {
        $versions = $this->versioning->getHistory($workflow);

        return response()->json(WorkflowVersionResource::collection($versions));
    }

    public function compare(AutomationWorkflow $workflow, string $versionA, string $versionB): JsonResponse
    {
        $a = WorkflowVersion::where('workflow_id', $workflow->id)->where('id', $versionA)->firstOrFail();
        $b = WorkflowVersion::where('workflow_id', $workflow->id)->where('id', $versionB)->firstOrFail();

        return response()->json($this->versioning->compare($a, $b));
    }

    public function restore(Request $request, AutomationWorkflow $workflow, WorkflowVersion $version): JsonResponse
    {
        if ($version->workflow_id !== $workflow->id) {
            abort(404);
        }

        $workflow = $this->versioning->restoreToVersion($workflow, $version, (string) $request->user()->id);

        return response()->json(new WorkflowResource($workflow));
    }
}
