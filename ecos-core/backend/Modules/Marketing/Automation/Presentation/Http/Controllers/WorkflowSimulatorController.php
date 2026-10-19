<?php

declare(strict_types=1);

namespace Modules\Marketing\Automation\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Marketing\Automation\Application\Actions\SimulateWorkflowAction;
use Modules\Marketing\Automation\Domain\Models\AutomationWorkflow;

class WorkflowSimulatorController extends Controller
{
    public function __construct(private readonly SimulateWorkflowAction $simulateAction) {}

    public function simulate(Request $request, AutomationWorkflow $workflow): JsonResponse
    {
        $validated = $request->validate([
            'sample_context' => 'nullable|array',
        ]);

        $result = $this->simulateAction->execute($workflow, $validated['sample_context'] ?? []);

        return response()->json($result);
    }
}
