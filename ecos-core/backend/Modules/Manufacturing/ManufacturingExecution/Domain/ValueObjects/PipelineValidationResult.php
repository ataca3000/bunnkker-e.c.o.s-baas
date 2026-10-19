<?php

declare(strict_types=1);

namespace Modules\Manufacturing\ManufacturingExecution\Domain\ValueObjects;

use Modules\Manufacturing\ManufacturingExecution\Domain\Enums\ValidationFailureCode;

/**
 * Aggregate result of all ExecutionPipeline validation checks.
 *
 * All failures are collected before returning — callers see every issue,
 * not just the first one that was hit.
 */
final readonly class PipelineValidationResult
{
    /**
     * @param  list<ValidationFailure>  $failures
     */
    public function __construct(
        public bool $is_valid,
        public array $failures = [],
    ) {}

    public static function valid(): self
    {
        return new self(is_valid: true, failures: []);
    }

    /** @param list<ValidationFailure> $failures */
    public static function invalid(array $failures): self
    {
        return new self(is_valid: false, failures: $failures);
    }

    public function hasFailure(ValidationFailureCode $code): bool
    {
        foreach ($this->failures as $failure) {
            if ($failure->code === $code) {
                return true;
            }
        }

        return false;
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'is_valid' => $this->is_valid,
            'failures' => array_map(
                fn (ValidationFailure $f): array => $f->toArray(),
                $this->failures,
            ),
        ];
    }
}
