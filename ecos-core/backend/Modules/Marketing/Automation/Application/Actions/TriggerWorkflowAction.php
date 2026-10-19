<?php

declare(strict_types=1);

namespace Modules\Marketing\Automation\Application\Actions;

use Modules\Marketing\Automation\Application\Services\WorkflowExecutionEngine;
use Modules\Marketing\Automation\Domain\Models\AutomationWorkflow;
use Modules\Marketing\Automation\Domain\Models\WorkflowExecution;

class TriggerWorkflowAction
{
    public function __construct(
        private readonly WorkflowExecutionEngine $engine,
    ) {}

    public function execute(
        AutomationWorkflow $workflow,
        string $entityType,
        string $entityId,
        string $triggerType = 'manual',
        array $payload = [],
        ?string $triggeredBy = null,
    ): WorkflowExecution {
        return $this->engine->dispatch(
            workflow: $workflow,
            entityType: $entityType,
            entityId: $entityId,
            triggerType: $triggerType,
            triggerPayload: $payload,
            triggeredBy: $triggeredBy,
        );
    }
}
