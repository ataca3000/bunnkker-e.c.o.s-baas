<?php

declare(strict_types=1);

namespace Modules\Operations\DemandAnalysis\Application\Listeners;

use Modules\Operations\DemandAnalysis\Application\Services\DemandCalculationService;
use Modules\Operations\Preparation\Domain\Events\WaveCreated;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;

/**
 * Initializes an empty KPI row when a new wave is created.
 * If the wave already has orders (engine attached them at creation), triggers a
 * full recalculation; otherwise just seeds the KPI record with zero values.
 */
final class WaveCreatedListener
{
    public function __construct(
        private readonly DemandCalculationService $service,
    ) {}

    public function handle(WaveCreated $event): void
    {
        $wave = PreparationWave::find($event->waveId);

        if ($wave === null) {
            return;
        }

        if ($event->ordersCount > 0) {
            $this->service->recalculate($wave, 'wave_created');
        } else {
            $this->service->initializeWave($wave);
        }
    }
}
