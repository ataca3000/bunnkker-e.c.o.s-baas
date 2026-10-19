<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\Services\WaveEngine;

use Modules\Operations\Preparation\Domain\Events\DemandRefreshRequested;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;

final class DemandRefreshDispatcher
{
    public function dispatch(
        PreparationWave $wave,
        string $trigger,
        string $requestedBy = 'system',
    ): void {
        event(new DemandRefreshRequested(
            waveId: $wave->id,
            companyId: $wave->company_id,
            warehouseId: $wave->warehouse_id,
            trigger: $trigger,
            requestedBy: $requestedBy,
            requestedAt: now()->toIso8601String(),
        ));
    }
}
