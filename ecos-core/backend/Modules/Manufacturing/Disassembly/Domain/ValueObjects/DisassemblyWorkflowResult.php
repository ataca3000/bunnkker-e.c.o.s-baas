<?php

declare(strict_types=1);

namespace Modules\Manufacturing\Disassembly\Domain\ValueObjects;

use Modules\Manufacturing\BillsOfMaterials\Domain\ValueObjects\RecipeSnapshot;

/**
 * Immutable outcome of DisassemblyWorkflow::run().
 *
 * Callers check isPlanReady() before passing to DisassemblyExecutor.
 */
final readonly class DisassemblyWorkflowResult
{
    /**
     * @param  array<string, mixed>  $metadata
     */
    public function __construct(
        public bool $is_blocked,
        public ?string $blocking_reason,
        public ?DisassemblyPlan $plan,
        public ?RecipeSnapshot $recipe_snapshot,
        public array $metadata = [],
    ) {}

    public function isPlanReady(): bool
    {
        return ! $this->is_blocked && $this->plan !== null;
    }

    /** @param  array<string, mixed>  $metadata */
    public static function blocked(string $reason, array $metadata = []): self
    {
        return new self(
            is_blocked: true,
            blocking_reason: $reason,
            plan: null,
            recipe_snapshot: null,
            metadata: $metadata,
        );
    }

    /** @param  array<string, mixed>  $metadata */
    public static function ready(DisassemblyPlan $plan, array $metadata = []): self
    {
        return new self(
            is_blocked: false,
            blocking_reason: null,
            plan: $plan,
            recipe_snapshot: $plan->recipe_snapshot,
            metadata: $metadata,
        );
    }
}
