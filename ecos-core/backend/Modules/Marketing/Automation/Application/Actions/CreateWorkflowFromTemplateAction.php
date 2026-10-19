<?php

declare(strict_types=1);

namespace Modules\Marketing\Automation\Application\Actions;

use Modules\Marketing\Automation\Application\Services\WorkflowTemplateService;
use Modules\Marketing\Automation\Domain\Models\AutomationWorkflow;
use Modules\Marketing\Automation\Domain\Models\AutomationWorkflowTemplate;

class CreateWorkflowFromTemplateAction
{
    public function __construct(
        private readonly WorkflowTemplateService $templateService,
    ) {}

    public function execute(AutomationWorkflowTemplate $template, array $overrides, string $userId): AutomationWorkflow
    {
        return $this->templateService->createWorkflowFromTemplate($template, $overrides, $userId);
    }
}
