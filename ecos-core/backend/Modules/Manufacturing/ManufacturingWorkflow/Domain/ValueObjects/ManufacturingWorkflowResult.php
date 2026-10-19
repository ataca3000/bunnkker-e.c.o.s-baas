<?php

declare(strict_types=1);

namespace Modules\Manufacturing\ManufacturingWorkflow\Domain\ValueObjects;

use Modules\Manufacturing\AvailabilityEngine\Domain\ValueObjects\AvailabilityResult;
use Modules\Manufacturing\BillsOfMaterials\Domain\ValueObjects\RecipeSnapshot;
use Modules\Manufacturing\DecisionKernel\Domain\ValueObjects\DecisionResult;
use Modules\Manufacturing\ManufacturingPlanner\Domain\ValueObjects\ManufacturingPlan;
use Modules\Manufacturing\ManufacturingWorkflow\Domain\Enums\WorkflowBlockingReason;
use Modules\Manufacturing\ManufacturingWorkflow\Domain\Enums\WorkflowStage;

/**
 * Immutable output of the ManufacturingWorkflow.
 *
 * Always returned — never throws for business-level outcomes.
 *
 * Consumers should check:
 *   1. is_blocked       — whether the workflow was stopped before producing a plan
 *   2. isPlanReady()    — whether the plan is present AND execution is needed
 *   3. blocking_reason  — which engine stopped the workflow and why
 *   4. stage            — which stage was reached before stopping
 *
 * NO inventory has been touched by the time this object is returned.
 */
final readonly class ManufacturingWorkflowResult
{
    public function __construct(
        /** UUID v4 generated at workflow start. Correlates log entries across engines. */
        public string $workflow_id,

        /** Last stage the workflow reached before returning. */
        public WorkflowStage $stage,

        /**
         * True when an engine or condition prevented the workflow from
         * producing a ready-to-execute plan.
         */
        public bool $is_blocked,

        /** Populated when is_blocked = true; null on success. */
        public ?WorkflowBlockingReason $blocking_reason,

        /** Decision Kernel result from the orchestrator. Null if the orchestrator threw. */
        public ?DecisionResult $decision_result,

        /**
         * Recipe snapshot resolved during the decision stage.
         * Present when the orchestrator resolved the recipe successfully.
         */
        public ?RecipeSnapshot $recipe_snapshot,

        /** Availability analysis. Null if the workflow stopped at the decision stage. */
        public ?AvailabilityResult $availability_result,

        /**
         * Manufacturing plan from the planner stage.
         * Present when the workflow reached PlanProduced stage.
         * may still be present when is_blocked = true (e.g. ManufacturingNotNeeded).
         */
        public ?ManufacturingPlan $plan,

        /** Merged metadata from the request and each engine. */
        public array $metadata,

        /** ISO 8601 timestamp of when the workflow finished. */
        public string $completed_at,
    ) {}

    /**
     * True when the workflow produced an execution-ready plan.
     * False when blocked, or when manufacturing is not needed (Sufficient stock).
     */
    public function isPlanReady(): bool
    {
        return $this->plan !== null
            && $this->plan->should_manufacture
            && ! $this->is_blocked;
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'workflow_id' => $this->workflow_id,
            'stage' => $this->stage->value,
            'is_blocked' => $this->is_blocked,
            'blocking_reason' => $this->blocking_reason?->value,
            'is_plan_ready' => $this->isPlanReady(),
            'decision_result' => $this->decision_result?->toArray(),
            'recipe_snapshot' => $this->recipe_snapshot?->toArray(),
            'availability_result' => $this->availability_result?->toArray(),
            'plan' => $this->plan?->toArray(),
            'metadata' => $this->metadata,
            'completed_at' => $this->completed_at,
        ];
    }
}
