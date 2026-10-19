<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\Services\WaveEngine;

use Illuminate\Support\Facades\DB;
use LogicException;
use Modules\Operations\Preparation\Domain\Enums\WaveStatus;
use Modules\Operations\Preparation\Domain\Events\OrderMovedToPreparing;
use Modules\Operations\Preparation\Domain\Events\WavePreparationStarted;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;
use RuntimeException;

final class WavePreparationService
{
    public function __construct(
        private readonly DemandRefreshDispatcher $demandDispatcher,
    ) {}

    /**
     * Transition a Collecting wave to Preparing and notify all current wave orders.
     * Idempotent: returns as-is if the wave is already Preparing.
     *
     * @throws RuntimeException if wave not found
     * @throws LogicException if wave is not in Collecting state
     */
    public function startPreparation(
        PreparationWave $wave,
        string $actorId = 'system',
    ): PreparationWave {
        return DB::transaction(function () use ($wave, $actorId): PreparationWave {
            $fresh = PreparationWave::where('id', $wave->id)->lockForUpdate()->first();

            if ($fresh === null) {
                throw new RuntimeException("Wave {$wave->id} not found.");
            }

            if ($fresh->status === WaveStatus::Preparing) {
                return $fresh;
            }

            if ($fresh->status !== WaveStatus::Collecting) {
                throw new LogicException(
                    "Cannot start preparation on wave in status '{$fresh->status->value}'. Expected 'collecting'.",
                );
            }

            $now = now();

            $fresh->update([
                'status' => WaveStatus::Preparing->value,
                'started_at' => $now,
                'started_by' => $actorId,
                'updated_by' => $actorId,
            ]);

            // Publish OrderMovedToPreparing for every order currently in this wave
            $orderIds = $fresh->waveOrders()->pluck('order_id')->all();

            foreach ($orderIds as $orderId) {
                event(new OrderMovedToPreparing(
                    waveId: $fresh->id,
                    orderId: $orderId,
                    companyId: $fresh->company_id,
                    warehouseId: $fresh->warehouse_id,
                    movedBy: $actorId,
                    movedAt: $now->toIso8601String(),
                ));
            }

            // C-1 fix: pass orderIds so HandlePreparationWavePreparationStarted
            // can transition each order to Preparing via the FulfillmentEngine.
            event(new WavePreparationStarted(
                waveId: $fresh->id,
                waveNumber: $fresh->wave_number,
                companyId: $fresh->company_id,
                warehouseId: $fresh->warehouse_id,
                planningDate: $fresh->planning_date->toDateString(),
                ordersCount: $fresh->orders_count,
                orderIds: $orderIds,
                startedBy: $actorId,
                startedAt: $now->toIso8601String(),
            ));

            $this->demandDispatcher->dispatch($fresh, 'preparation_started', $actorId);

            return $fresh->refresh();
        });
    }
}
