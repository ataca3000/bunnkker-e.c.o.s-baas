<?php

declare(strict_types=1);

namespace Modules\Marketing\Automation\Application\Actions;

use Modules\Marketing\Automation\Application\Services\WorkflowExecutionEngine;
use Modules\Marketing\Automation\Domain\Models\WorkflowExecution;

class ProcessWorkflowExecutionAction
{
    public function __construct(
        private readonly WorkflowExecutionEngine $engine,
    ) {}

    public function execute(WorkflowExecution $execution): void
    {
        $this->engine->process($execution);
    }
}
