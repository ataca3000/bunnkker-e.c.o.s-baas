<?php

declare(strict_types=1);

namespace Modules\CostManagement\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Modules\CostManagement\Domain\Enums\PricingTriggerReason;

/**
 * Fired whenever a finished product's calculated cost changes.
 *
 * This is the canonical cost-change event (TASK-COST-ARCH-002 Part 8).
 * Replaces the generic ProductCostChanged event.
 * CostImpactEngine listens to this event and drives Pricing Review upserts.
 *
 * The event is immutable. Listeners must NOT modify the payload.
 */
final class FinishedProductCostChanged
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly string $productId,
        public readonly string $companyId,
        public readonly float $oldCost,
        public readonly float $newCost,
        public readonly float $difference,
        public readonly float $differencePercent,
        public readonly PricingTriggerReason $triggerReason,
        public readonly ?string $triggerSource,
        /** ISO-8601 timestamp when the cost change occurred */
        public readonly string $occurredAt,
        /** Optional: full cost breakdown snapshot for this calculation */
        public readonly ?array $costSnapshot = null,
        /** Optional: ID of the cost history record that triggered this */
        public readonly ?string $costHistoryId = null,
    ) {}
}
