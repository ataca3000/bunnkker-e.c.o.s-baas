<?php

declare(strict_types=1);

namespace Modules\Operations\Fulfillment\Domain\Exceptions;

use RuntimeException;
use Throwable;

/**
 * Thrown when a workflow encounters an unexpected runtime failure
 * that is not a precondition violation.
 */
final class WorkflowExecutionException extends RuntimeException
{
    public function __construct(string $workflowName, string $reason, ?Throwable $previous = null)
    {
        parent::__construct("[{$workflowName}] Execution failed: {$reason}", 0, $previous);
    }
}
