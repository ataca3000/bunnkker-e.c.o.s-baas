<?php

declare(strict_types=1);

namespace Modules\Operations\DemandAnalysis\Application\Listeners;

use Modules\Operations\DemandAnalysis\Application\Services\DemandCalculationService;
use Modules\Operations\DemandAnalysis\Application\Services\ProductDemandCalculator;
use Modules\Operations\Preparation\Domain\Events\OrderRemovedFromWave;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;

/**
 * Incremental recalculation when an order leaves a wave.
 *
 * Strategy: the order's products must be re-totalled from ALL remaining orders
 * in the wave (not just decremented), because the engine stores aggregated
 * totals rather than per-order rows. We get the affected product IDs from the
 * order's lines before the next calculation run.
 */
final class OrderRemovedFromWaveListener
{
    public function __construct(
        private readonly DemandCalculationService $service,
        private readonly ProductDemandCalculator $productCalc,
    ) {}

    public function handle(OrderRemovedFromWave $event): void
    {
        $wave = PreparationWave::find($event->waveId);

        if ($wave === null) {
            return;
        }

        // Derive which products this order contained so we recalculate only those.
        $affectedProductIds = $this->productCalc->productIdsForOrder($event->orderId);

        if (empty($affectedProductIds)) {
            return;
        }

        $this->service->recalculateForOrders($wave, [$event->orderId], 'order_removed');
    }
}
