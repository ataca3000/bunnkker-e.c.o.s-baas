<?php

declare(strict_types=1);

namespace Modules\Operations\DemandAnalysis\Application\Services;

use Illuminate\Support\Facades\Log;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;
use Throwable;

/**
 * Main entry point for all demand recalculation requests.
 *
 * Listeners call this service; it decides full vs incremental recalculation
 * and delegates to DemandProjectionBuilder.
 */
final class DemandCalculationService
{
    public function __construct(
        private readonly DemandProjectionBuilder $builder,
        private readonly DemandReadRepository $repository,
    ) {}

    /**
     * Full recalculation for a wave.
     * Called when DemandRefreshRequested fires or when a significant wave event occurs.
     */
    public function recalculate(PreparationWave $wave, string $trigger = 'demand_refresh'): void
    {
        try {
            $this->builder->buildFull($wave, $trigger);
        } catch (Throwable $e) {
            Log::error('DemandCalculationService: full recalculation failed', [
                'wave_id' => $wave->id,
                'trigger' => $trigger,
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    /**
     * Incremental recalculation scoped to specific orders.
     * Called when a single order is added to or removed from the wave.
     *
     * @param  list<string>  $orderIds
     */
    public function recalculateForOrders(
        PreparationWave $wave,
        array $orderIds,
        string $trigger = 'order_change',
    ): void {
        if (empty($orderIds)) {
            return;
        }

        try {
            $this->builder->buildIncremental($wave, $orderIds, $trigger);
        } catch (Throwable $e) {
            Log::error('DemandCalculationService: incremental recalculation failed', [
                'wave_id' => $wave->id,
                'order_ids' => $orderIds,
                'trigger' => $trigger,
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    /**
     * Initialize empty KPI row when a new wave is created.
     * No order lines exist yet — projections are empty but the row is created.
     */
    public function initializeWave(PreparationWave $wave): void
    {
        $now = now()->toDateTimeString();

        $this->repository->upsertWaveKpis([
            'id' => (string) \Illuminate\Support\Str::uuid(),
            'company_id' => $wave->company_id,
            'warehouse_id' => $wave->warehouse_id,
            'preparation_wave_id' => $wave->id,
            'orders_count' => 0,
            'products_count' => 0,
            'materials_count' => 0,
            'missing_materials_count' => 0,
            'prepared_count' => 0,
            'remaining_count' => 0,
            'completion_pct' => 0.0,
            'last_calculated_at' => $now,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }

    /** Remove all projections when a wave is deleted. */
    public function clearWave(string $waveId): void
    {
        $this->repository->clearWaveDemand($waveId);
    }
}
