<?php

declare(strict_types=1);

namespace Modules\Manufacturing\ManufacturingExecution\Domain\ValueObjects;

use Modules\Manufacturing\ManufacturingExecution\Domain\Enums\ValidationFailureCode;

/**
 * A single typed validation failure from the ExecutionPipeline.
 *
 * Failures are collected and returned inside PipelineValidationResult.
 * They are never thrown as exceptions.
 */
final readonly class ValidationFailure
{
    public function __construct(
        public ValidationFailureCode $code,
        public string $message,
        public array $context = [],
    ) {}

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'code' => $this->code->value,
            'message' => $this->message,
            'context' => $this->context,
        ];
    }
}
