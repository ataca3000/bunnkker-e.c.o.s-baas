<?php

declare(strict_types=1);

namespace Modules\Manufacturing\ManufacturingExecution\Domain\Exceptions;

use RuntimeException;

/**
 * Thrown for unrecoverable pipeline-internal errors — NOT for business validation failures.
 *
 * Business validation failures (hash mismatch, expired plan, etc.) are returned
 * as ValidationFailure objects inside PipelineValidationResult.
 *
 * PipelineException is reserved for cases where the pipeline itself cannot
 * function correctly (e.g. a timestamp that is completely unparseable).
 */
final class PipelineException extends RuntimeException
{
    public const CLOCK_FAILURE = 'clock_failure';

    private readonly string $reason;

    private function __construct(string $message, string $reason)
    {
        parent::__construct($message);
        $this->reason = $reason;
    }

    public static function clockFailure(string $plannedAt): self
    {
        return new self(
            "Cannot parse plan timestamp for expiry check: \"{$plannedAt}\"",
            self::CLOCK_FAILURE,
        );
    }

    public function reason(): string
    {
        return $this->reason;
    }
}
