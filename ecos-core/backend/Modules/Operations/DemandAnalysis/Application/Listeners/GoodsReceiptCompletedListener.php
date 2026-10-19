<?php

declare(strict_types=1);

namespace Modules\Operations\DemandAnalysis\Application\Listeners;

use Illuminate\Support\Facades\DB;
use Modules\Operations\DemandAnalysis\Application\Services\DemandProjectionBuilder;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;

/**
 * When a goods receipt is completed, raw-material stock increases.
 * Recalculate material demand for all active waves that use the received material.
 *
 * Wire-up: register this listener against your Procurement module's
 * GoodsReceiptCompleted event when it exists. The event must carry `$materialId`.
 *
 * This listener is intentionally decoupled from the event class so it can be
 * adapted to whatever contract the Procurement module defines.
 */
final class GoodsReceiptCompletedListener
{
    public function __construct(
        private readonly DemandProjectionBuilder $builder,
    ) {}

    /**
     * @param  object{materialId: string, warehouseId: string}  $event
     */
    public function handle(object $event): void
    {
        // Find all active waves in the affected warehouse whose demand includes this material.
        $waveIds = DB::table('wave_material_demand as wmd')
            ->join('preparation_waves as pw', 'pw.id', '=', 'wmd.preparation_wave_id')
            ->where('wmd.material_id', $event->materialId)
            ->where('pw.warehouse_id', $event->warehouseId)
            ->whereIn('pw.status', ['collecting', 'preparing'])
            ->pluck('wmd.preparation_wave_id')
            ->all();

        foreach ($waveIds as $waveId) {
            $wave = PreparationWave::find($waveId);

            if ($wave !== null) {
                $this->builder->buildFull($wave, 'goods_receipt_completed');
            }
        }
    }
}
