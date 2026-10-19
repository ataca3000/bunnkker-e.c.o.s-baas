<?php

declare(strict_types=1);

namespace Modules\Marketing\Automation\Application\Actions;

use Modules\Marketing\Automation\Domain\Enums\WorkflowStatus;
use Modules\Marketing\Automation\Domain\Models\AutomationWorkflow;
use RuntimeException;

class PauseWorkflowAction
{
    public function execute(AutomationWorkflow $workflow, string $userId): AutomationWorkflow
    {
        if (! $workflow->status->canPause()) {
            throw new RuntimeException("Workflow '{$workflow->name}' cannot be paused from status '{$workflow->status->value}'.");
        }

        $workflow->update([
            'status' => WorkflowStatus::PAUSED,
            'paused_at' => now(),
            'updated_by' => $userId,
        ]);

        return $workflow->fresh();
    }
}
