<?php

declare(strict_types=1);

namespace Modules\Manufacturing\DecisionOrchestrator\Domain\Contracts;

use Modules\Manufacturing\DecisionKernel\Domain\ValueObjects\DecisionContext;

/**
 * Contract for typed context builders.
 *
 * Each builder knows how to convert domain-specific parameters into a
 * generic DecisionContext. The Orchestrator asks the builder for:
 *   - The context type string (to select the right RuleProvider)
 *   - Whether recipe resolution is required before evaluation
 *   - The fully built context
 *
 * Implementations:
 *   - ManufacturingContextBuilder  — shortage_qty, product_id, allow_negative_stock
 *   - GoodsReceiptContextBuilder   — received_qty, ordered_qty, variance_pct
 *   - SchedulerContextBuilder      — future: schedule horizon, pending orders
 *   - AiContextBuilder             — future: model recommendation data
 *
 * Builders are pure — no DB reads, no side effects.
 */
interface ContextBuilderInterface
{
    /** Domain identifier used to look up the correct RuleProvider in the registry. */
    public function contextType(): string;

    /**
     * Whether the Orchestrator must call RecipeResolver before invoking the kernel.
     * Builders that need recipe data (e.g. component list) return true.
     * Callers MUST supply `product_id` in $parameters when this returns true.
     */
    public function requiresRecipe(): bool;

    /**
     * Build an immutable DecisionContext from domain-specific parameters.
     * Never reads the database. Never calls external services.
     *
     * @param  array<string, mixed>  $parameters
     */
    public function build(array $parameters): DecisionContext;
}
