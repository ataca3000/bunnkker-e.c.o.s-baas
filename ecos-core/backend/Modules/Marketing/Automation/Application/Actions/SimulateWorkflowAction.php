<?php

declare(strict_types=1);

namespace Modules\Marketing\Automation\Application\Actions;

use Modules\Marketing\Automation\Application\Services\WorkflowSimulatorService;
use Modules\Marketing\Automation\Domain\Models\AutomationWorkflow;

class SimulateWorkflowAction
{
    public function __construct(
        private readonly WorkflowSimulatorService $simulator,
    ) {}

    public function execute(AutomationWorkflow $workflow, array $sampleContext = []): array
    {
        return $this->simulator->simulate($workflow, $sampleContext);
    }
}
