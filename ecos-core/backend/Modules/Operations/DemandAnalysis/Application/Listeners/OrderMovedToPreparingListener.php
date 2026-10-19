<?php

declare(strict_types=1);

namespace Modules\Operations\DemandAnalysis\Application\Listeners;

use Modules\Operations\DemandAnalysis\Application\Services\DemandCalculationService;
use Modules\Operations\Preparation\Domain\Events\OrderMovedToPreparing;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;

/**
 * When an order transitions to Preparing, its prepared_qty fields may have
 * changed. Triggers an incremental recalculation for the order's products.
 */
final class OrderMovedToPreparingListener
{
    public function __construct(
        private readonly DemandCalculationService $service,
    ) {}

    public function handle(OrderMovedToPreparing $event): void
    {
        $wave = PreparationWave::find($event->waveId);

        if ($wave === null) {
            return;
        }

        $this->service->recalculateForOrders($wave, [$event->orderId], 'order_moved_to_preparing');
    }
}
