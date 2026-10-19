<?php

declare(strict_types=1);

namespace Modules\Operations\DemandAnalysis\Application\Listeners;

use Modules\Operations\DemandAnalysis\Application\Services\DemandCalculationService;
use Modules\Operations\Preparation\Domain\Events\DemandRefreshRequested;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;

/**
 * Triggers a full wave recalculation when any part of the Wave Engine
 * requests a demand refresh (order added/removed, preparation started, etc.).
 */
final class DemandRefreshRequestedListener
{
    public function __construct(
        private readonly DemandCalculationService $service,
    ) {}

    public function handle(DemandRefreshRequested $event): void
    {
        $wave = PreparationWave::find($event->waveId);

        if ($wave === null) {
            return;
        }

        $this->service->recalculate($wave, $event->trigger);
    }
}
