<?php

declare(strict_types=1);

namespace Modules\Operations\Fulfillment\Domain\Exceptions;

use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

/**
 * Thrown when a workflow's guard() detects a precondition is not met.
 * Maps to HTTP 422.
 */
final class WorkflowPreconditionException extends UnprocessableEntityHttpException
{
    public function __construct(string $message, ?string $reason = null)
    {
        parent::__construct($reason !== null ? "[{$message}] Precondition not met: {$reason}" : $message);
    }
}
