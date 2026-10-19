<?php

declare(strict_types=1);

namespace Modules\Operations\DemandAnalysis\Application\Listeners;

use Illuminate\Support\Facades\DB;
use Modules\Operations\DemandAnalysis\Application\Services\DemandProjectionBuilder;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;

/**
 * When inventory is returned (e.g., a delivery return increases available stock),
 * recalculate material demand for affected active waves.
 *
 * Wire-up: register against your Inventory module's InventoryReturned event.
 * Event must carry `$productId` and `$warehouseId`.
 */
final class InventoryReturnedListener
{
    public function __construct(
        private readonly DemandProjectionBuilder $builder,
    ) {}

    /**
     * @param  object{productId: string, warehouseId: string}  $event
     */
    public function handle(object $event): void
    {
        $waveIds = DB::table('wave_material_demand as wmd')
            ->join('preparation_waves as pw', 'pw.id', '=', 'wmd.preparation_wave_id')
            ->where('wmd.material_id', $event->productId)
            ->where('pw.warehouse_id', $event->warehouseId)
            ->whereIn('pw.status', ['collecting', 'preparing'])
            ->pluck('wmd.preparation_wave_id')
            ->all();

        foreach ($waveIds as $waveId) {
            $wave = PreparationWave::find($waveId);

            if ($wave !== null) {
                $this->builder->buildFull($wave, 'inventory_returned');
            }
        }
    }
}
