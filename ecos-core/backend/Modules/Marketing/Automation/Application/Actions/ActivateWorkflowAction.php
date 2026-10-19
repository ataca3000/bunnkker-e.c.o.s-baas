<?php

declare(strict_types=1);

namespace Modules\Marketing\Automation\Application\Actions;

use Modules\Marketing\Automation\Application\Services\WorkflowVersioningService;
use Modules\Marketing\Automation\Domain\Enums\WorkflowStatus;
use Modules\Marketing\Automation\Domain\Models\AutomationWorkflow;
use RuntimeException;

class ActivateWorkflowAction
{
    public function __construct(
        private readonly WorkflowVersioningService $versioning,
    ) {}

    public function execute(AutomationWorkflow $workflow, string $userId): AutomationWorkflow
    {
        if (! $workflow->status->canActivate()) {
            throw new RuntimeException("Workflow '{$workflow->name}' cannot be activated from status '{$workflow->status->value}'.");
        }

        $this->versioning->snapshot($workflow, $userId, 'Activated');

        $workflow->update([
            'status' => WorkflowStatus::ACTIVE,
            'activated_at' => now(),
            'paused_at' => null,
            'updated_by' => $userId,
        ]);

        return $workflow->fresh();
    }
}
