<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\Services\WaveEngine;

use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Modules\Operations\Preparation\Domain\Enums\WaveStatus;
use Modules\Operations\Preparation\Domain\Events\WaveClosed;
use Modules\Operations\Preparation\Domain\Events\WaveCreated;
use Modules\Operations\Preparation\Domain\Events\WaveRotated;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;

final class WaveLifecycleService
{
    public function __construct(
        private readonly WaveManager $waveManager,
        private readonly DemandRefreshDispatcher $demandDispatcher,
    ) {}

    /**
     * Idempotent: returns existing Collecting/Preparing wave if one exists for this date+warehouse.
     */
    public function createCollectingWave(
        string $companyId,
        string $warehouseId,
        string $planningDate,
        string $actorId = 'system',
    ): PreparationWave {
        return DB::transaction(function () use ($companyId, $warehouseId, $planningDate, $actorId): PreparationWave {
            $existing = PreparationWave::where('company_id', $companyId)
                ->where('warehouse_id', $warehouseId)
                ->where('planning_date', $planningDate)
                ->whereIn('status', [WaveStatus::Collecting->value, WaveStatus::Preparing->value])
                ->lockForUpdate()
                ->first();

            if ($existing !== null) {
                return $existing;
            }

            $waveNumber = $this->generateWaveNumber($companyId, $planningDate);

            $wave = PreparationWave::create([
                'company_id' => $companyId,
                'warehouse_id' => $warehouseId,
                'wave_number' => $waveNumber,
                'planning_date' => $planningDate,
                'status' => WaveStatus::Collecting->value,
                'wave_type' => 'engine',
                'created_by' => $actorId,
                'updated_by' => $actorId,
            ]);

            event(new WaveCreated(
                waveId: $wave->id,
                waveNumber: $waveNumber,
                companyId: $companyId,
                warehouseId: $warehouseId,
                planningDate: $planningDate,
                ordersCount: 0,
                orderIds: [],
                createdBy: $actorId,
                configVersionId: '',
            ));

            return $wave;
        });
    }

    /**
     * Transition wave to Closed status. Idempotent: returns as-is if already Closed.
     */
    public function closeWave(
        PreparationWave $wave,
        string $actorId = 'system',
        string $reason = 'scheduled',
    ): PreparationWave {
        return DB::transaction(function () use ($wave, $actorId, $reason): PreparationWave {
            $fresh = PreparationWave::where('id', $wave->id)->lockForUpdate()->first();

            if ($fresh === null) {
                return $wave;
            }

            if ($fresh->status === WaveStatus::Closed) {
                return $fresh;
            }

            if ($fresh->status->isTerminal()) {
                return $fresh;
            }

            $now = now();

            $fresh->update([
                'status' => WaveStatus::Closed->value,
                'completed_at' => $now,
                'completed_by' => $actorId,
                'updated_by' => $actorId,
            ]);

            event(new WaveClosed(
                waveId: $fresh->id,
                waveNumber: $fresh->wave_number,
                companyId: $fresh->company_id,
                warehouseId: $fresh->warehouse_id,
                planningDate: $fresh->planning_date->toDateString(),
                closedBy: $actorId,
                closedAt: $now->toIso8601String(),
                reason: $reason,
            ));

            return $fresh->refresh();
        });
    }

    /**
     * Close the current wave and create the next Collecting wave for the following day.
     */
    public function rotateWave(
        PreparationWave $wave,
        string $actorId = 'system',
    ): PreparationWave {
        $this->closeWave($wave, $actorId, 'rotation');

        $nextDate = Carbon::parse($wave->planning_date)->addDay()->toDateString();
        $newWave = $this->createCollectingWave($wave->company_id, $wave->warehouse_id, $nextDate, $actorId);

        event(new WaveRotated(
            closedWaveId: $wave->id,
            newWaveId: $newWave->id,
            newWaveNumber: $newWave->wave_number,
            companyId: $wave->company_id,
            warehouseId: $wave->warehouse_id,
            rotatedBy: $actorId,
            rotatedAt: now()->toIso8601String(),
        ));

        return $newWave;
    }

    /**
     * Same sequential number scheme as CreateWaveAction (PREP-YYYYMM-000001).
     */
    private function generateWaveNumber(string $companyId, string $planningDate): string
    {
        $yearMonth = Carbon::parse($planningDate)->format('Ym');

        $last = PreparationWave::where('company_id', $companyId)
            ->where('wave_number', 'like', "PREP-{$yearMonth}-%")
            ->max('wave_number');

        $seq = $last === null ? 1 : ((int) Str::afterLast($last, '-')) + 1;

        return sprintf('PREP-%s-%06d', $yearMonth, $seq);
    }
}
