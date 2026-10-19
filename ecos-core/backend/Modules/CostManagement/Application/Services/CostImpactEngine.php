<?php

declare(strict_types=1);

namespace Modules\CostManagement\Application\Services;

use Modules\CostManagement\Domain\Events\FinishedProductCostChanged;
use Modules\CostManagement\Domain\Services\PricingReviewService;
use Modules\Inventory\Products\Domain\Models\Product;

/**
 * Enterprise Cost Impact Engine — TASK-COST-ARCH-002 Part 9.
 *
 * Single responsibility: react to FinishedProductCostChanged and propagate
 * the cost impact across the Pricing Review system.
 *
 * Workflow:
 *  FinishedProductCostChanged → CostImpactEngine
 *    → upsert PricingReview (with immutable cost snapshot + explanation)
 *    → [future] publish cost-change notifications
 *    → [future] trigger executive dashboard refresh
 *
 * Heavy cascades must be dispatched via RecalculateProductCostJob so the
 * HTTP request cycle is never blocked (TASK-COST-ARCH-002 Part 13).
 */
final class CostImpactEngine
{
    public function __construct(
        private readonly PricingReviewService $pricingReviews,
    ) {}

    /** Handle a FinishedProductCostChanged domain event. */
    public function handle(FinishedProductCostChanged $event): void
    {
        $product = Product::find($event->productId);

        if ($product === null) {
            return;
        }

        $costSnapshot = $this->buildSnapshot($event);
        $explanation = $this->buildExplanation($event);

        $this->pricingReviews->upsertForProduct(
            product: $product,
            newProductCost: $event->newCost,
            previousProductCost: $event->oldCost,
            companyId: $event->companyId,
            historyId: $event->costHistoryId,
            triggerReason: $event->triggerReason->value,
            triggerSource: $event->triggerSource,
            costSnapshot: $costSnapshot,
            explanation: $explanation,
        );
    }

    /** Build an immutable snapshot of the cost state at event time. */
    private function buildSnapshot(FinishedProductCostChanged $event): array
    {
        $base = [
            'old_cost' => $event->oldCost,
            'new_cost' => $event->newCost,
            'difference' => $event->difference,
            'difference_pct' => $event->differencePercent,
            'trigger_reason' => $event->triggerReason->value,
            'trigger_source' => $event->triggerSource,
            'occurred_at' => $event->occurredAt,
        ];

        if ($event->costSnapshot !== null) {
            $base['cost_breakdown'] = $event->costSnapshot;
        }

        return $base;
    }

    /** Generate a human-readable explanation of the cost change. */
    private function buildExplanation(FinishedProductCostChanged $event): string
    {
        $direction = $event->difference > 0 ? 'increased' : 'decreased';
        $absDiff = abs($event->difference);
        $absPct = abs($event->differencePercent);

        $reason = $event->triggerReason->label();
        $source = $event->triggerSource ? " ({$event->triggerSource})" : '';

        $lines = [
            "Product cost {$direction} by ".number_format($absDiff, 2).' EGP',
            "({$absPct}% change)",
            "Trigger: {$reason}{$source}",
        ];

        if (isset($event->costSnapshot['cost_breakdown'])) {
            $bd = $event->costSnapshot['cost_breakdown'];
            if (($bd['packaging_cost'] ?? 0) > 0) {
                $lines[] = 'Packaging cost: '.number_format((float) $bd['packaging_cost'], 2).' EGP';
            }
        }

        $lines[] = number_format($event->oldCost, 2).' → '.number_format($event->newCost, 2).' EGP';

        return implode("\n", $lines);
    }
}
