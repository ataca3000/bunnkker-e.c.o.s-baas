<?php

declare(strict_types=1);

namespace Modules\Manufacturing\DecisionOrchestrator\Domain\ValueObjects;

use Modules\Manufacturing\BillsOfMaterials\Domain\ValueObjects\RecipeSnapshot;
use Modules\Manufacturing\DecisionKernel\Domain\ValueObjects\DecisionResult;

/**
 * Immutable output of the Decision Orchestrator.
 *
 * Carries the kernel's DecisionResult together with any optional
 * supplementary data produced during orchestration (recipe snapshot,
 * merged metadata).
 *
 * Callers receive this and act on `decision.decision`. They may inspect
 * `recipe_snapshot` to know which recipe version the decision was based on
 * (important for RC-10: unique constraint on bom_version_number).
 */
final readonly class OrchestratorResult
{
    /**
     * @param  array<string, mixed>  $metadata  Merged orchestrator metadata.
     */
    public function __construct(
        /** Full decision result from the kernel. */
        public DecisionResult $decision,

        /**
         * Resolved recipe snapshot — non-null only when the context builder
         * declared requiresRecipe() = true and resolution succeeded.
         */
        public ?RecipeSnapshot $recipe_snapshot = null,

        public array $metadata = [],
    ) {}

    /** True if a recipe was resolved during orchestration. */
    public function hasRecipe(): bool
    {
        return $this->recipe_snapshot !== null;
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'decision' => $this->decision->toArray(),
            'recipe_snapshot' => $this->recipe_snapshot?->toArray(),
            'metadata' => $this->metadata,
        ];
    }
}
