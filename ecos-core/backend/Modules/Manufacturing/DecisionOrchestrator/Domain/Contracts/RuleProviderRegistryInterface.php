<?php

declare(strict_types=1);

namespace Modules\Manufacturing\DecisionOrchestrator\Domain\Contracts;

use Modules\Manufacturing\DecisionKernel\Domain\Contracts\RuleProviderInterface;
use Modules\Manufacturing\DecisionOrchestrator\Domain\Exceptions\NoProviderForContextException;

/**
 * Registry that maps context types to their RuleProviders.
 *
 * The Orchestrator calls `for($contextType)` to retrieve the correct rule set
 * before invoking the Decision Kernel. Different callers register different
 * providers for their domain:
 *
 *   "manufacturing" → ManufacturingRuleProvider
 *   "goods_receipt" → GoodsReceiptRuleProvider
 *   "procurement"   → ProcurementRuleProvider
 *   "ai"            → AiRuleProvider
 *
 * Current implementation: InMemoryRuleProviderRegistry.
 * Future: DB-backed, config-driven, or dynamically loaded registry.
 */
interface RuleProviderRegistryInterface
{
    /**
     * Returns the RuleProvider registered for the given context type.
     *
     * @throws NoProviderForContextException when no provider is registered.
     */
    public function for(string $contextType): RuleProviderInterface;

    /** Register a provider for a context type. Returns $this for fluent chaining. */
    public function register(string $contextType, RuleProviderInterface $provider): static;

    /** Returns true if a provider is registered for this context type. */
    public function has(string $contextType): bool;
}
