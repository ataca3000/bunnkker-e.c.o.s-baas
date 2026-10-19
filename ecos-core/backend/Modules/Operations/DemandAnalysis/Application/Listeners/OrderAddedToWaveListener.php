<?php

declare(strict_types=1);

namespace Modules\Operations\DemandAnalysis\Application\Listeners;

use Modules\Operations\DemandAnalysis\Application\Services\DemandCalculationService;
use Modules\Operations\Preparation\Domain\Events\OrderAddedToWave;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;

/**
 * Incremental recalculation when a single order joins a wave.
 * Only the products contained in that order are recalculated.
 */
final class OrderAddedToWaveListener
{
    public function __construct(
        private readonly DemandCalculationService $service,
    ) {}

    public function handle(OrderAddedToWave $event): void
    {
        $wave = PreparationWave::find($event->waveId);

        if ($wave === null) {
            return;
        }

        $this->service->recalculateForOrders($wave, [$event->orderId], 'order_added');
    }
}
