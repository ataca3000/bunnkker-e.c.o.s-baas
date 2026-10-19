<?php

declare(strict_types=1);

namespace Modules\Manufacturing\DecisionOrchestrator\Domain\Services;

use Modules\Manufacturing\BillsOfMaterials\Domain\Contracts\RecipeResolverInterface;
use Modules\Manufacturing\BillsOfMaterials\Domain\ValueObjects\RecipeSnapshot;
use Modules\Manufacturing\DecisionKernel\Domain\Services\DecisionKernel;
use Modules\Manufacturing\DecisionKernel\Domain\ValueObjects\DecisionContext;
use Modules\Manufacturing\DecisionKernel\Domain\ValueObjects\DecisionTrigger;
use Modules\Manufacturing\DecisionOrchestrator\Domain\Contracts\ContextBuilderInterface;
use Modules\Manufacturing\DecisionOrchestrator\Domain\Contracts\RuleProviderRegistryInterface;
use Modules\Manufacturing\DecisionOrchestrator\Domain\Exceptions\OrchestratorException;
use Modules\Manufacturing\DecisionOrchestrator\Domain\ValueObjects\OrchestratorResult;

/**
 * Decision Orchestrator — coordinates domain engines without executing operations.
 *
 * Flow:
 *   1. Build DecisionContext via the provided ContextBuilder.
 *   2. If builder declares requiresRecipe() = true, resolve the recipe via
 *      RecipeResolverInterface and enrich the context with recipe metadata.
 *   3. Select the correct RuleProvider from the registry by context type.
 *   4. Invoke the Decision Kernel.
 *   5. Return an immutable OrchestratorResult.
 *
 * The Orchestrator MUST NOT:
 *   - Consume inventory
 *   - Manufacture products
 *   - Create transactions
 *   - Update cost records
 *   - Dispatch events or jobs
 *   - Write database records
 *   - Create decision logs
 *
 * Callers: ManufacturingEngine, GoodsReceiptEngine, ProcurementScheduler, CLI, API.
 * The Orchestrator does not know which caller is invoking it.
 */
final class DecisionOrchestrator
{
    public function __construct(
        private readonly RecipeResolverInterface $resolver,
        private readonly DecisionKernel $kernel,
        private readonly RuleProviderRegistryInterface $registry,
    ) {}

    /**
     * Orchestrate a decision for the given trigger and context.
     *
     * @param  array<string, mixed>  $parameters  Domain-specific parameters for the builder.
     * @param  array<string, mixed>  $metadata  Caller metadata merged into OrchestratorResult.
     *
     * @throws OrchestratorException When builder requires recipe but product_id is absent.
     * @throws \Modules\Manufacturing\BillsOfMaterials\Domain\Exceptions\RecipeResolverException
     *                                                                                           When recipe resolution fails (propagated unchanged).
     * @throws \Modules\Manufacturing\DecisionKernel\Domain\Exceptions\NoMatchingRuleException
     *                                                                                         When no rule matches (propagated unchanged).
     * @throws \Modules\Manufacturing\DecisionOrchestrator\Domain\Exceptions\NoProviderForContextException
     *                                                                                                     When no rule provider is registered for this context type.
     */
    public function orchestrate(
        DecisionTrigger $trigger,
        ContextBuilderInterface $builder,
        array $parameters,
        array $metadata = [],
    ): OrchestratorResult {
        // ── Step 1: Build context ─────────────────────────────────────────────
        $context = $builder->build($parameters);

        // ── Step 2: Optionally resolve recipe ─────────────────────────────────
        $snapshot = null;

        if ($builder->requiresRecipe()) {
            $productId = $parameters['product_id'] ?? null;

            if (! is_string($productId) || $productId === '') {
                throw OrchestratorException::missingProductId($context->context_type);
            }

            $snapshot = $this->resolver->resolve($productId);
            $context = $this->enrichWithRecipe($context, $snapshot);
        }

        // ── Step 3: Select rule provider ──────────────────────────────────────
        $rules = $this->registry->for($context->context_type);

        // ── Step 4: Evaluate kernel ───────────────────────────────────────────
        $decision = $this->kernel->evaluate($trigger, $context, $rules);

        // ── Step 5: Merge metadata + return ──────────────────────────────────
        $mergedMetadata = $this->buildMetadata($context, $snapshot, $metadata);

        return new OrchestratorResult(
            decision: $decision,
            recipe_snapshot: $snapshot,
            metadata: $mergedMetadata,
        );
    }

    /**
     * Enrich the context with recipe metadata so rules can access recipe data
     * without depending on RecipeSnapshot directly.
     */
    private function enrichWithRecipe(DecisionContext $context, RecipeSnapshot $snapshot): DecisionContext
    {
        return $context
            ->with('recipe_id', $snapshot->recipe_id)
            ->with('bom_version_number', $snapshot->bom_version_number)
            ->with('component_count', $snapshot->componentCount())
            ->with('recipe_resolved', true);
    }

    /**
     * Build the merged metadata for OrchestratorResult.
     *
     * @param  array<string, mixed>  $callerMetadata
     * @return array<string, mixed>
     */
    private function buildMetadata(
        DecisionContext $context,
        ?RecipeSnapshot $snapshot,
        array $callerMetadata,
    ): array {
        $base = [
            'context_type' => $context->context_type,
        ];

        if ($snapshot !== null) {
            $base['recipe_id'] = $snapshot->recipe_id;
            $base['bom_version_number'] = $snapshot->bom_version_number;
        }

        return array_merge($base, $callerMetadata);
    }
}
