<?php

declare(strict_types=1);

namespace Modules\Manufacturing\DecisionKernel\Domain\Contracts;

/**
 * Supplies a set of rules to the Decision Kernel for a given evaluation call.
 *
 * Different callers supply different providers:
 *   - ManufacturingEngine  → ManufacturingRuleProvider
 *   - FulfillmentEngine    → FulfillmentRuleProvider
 *   - ProcurementScheduler → ProcurementRuleProvider
 *   - AI Engine            → AiRuleProvider
 *
 * Current implementation: InMemoryRuleProvider.
 * Future: EloquentRuleProvider, AiRuleProvider, etc.
 */
interface RuleProviderInterface
{
    /** @return list<DecisionRuleInterface> */
    public function rules(): array;
}
