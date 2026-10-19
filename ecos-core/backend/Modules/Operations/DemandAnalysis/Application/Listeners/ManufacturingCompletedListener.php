<?php

declare(strict_types=1);

namespace Modules\Operations\DemandAnalysis\Application\Listeners;

use Illuminate\Support\Facades\DB;
use Modules\Operations\DemandAnalysis\Application\Services\DemandProjectionBuilder;
use Modules\Operations\Preparation\Application\Events\Inbound\ManufacturingJobCompletedEvent;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;

/**
 * When manufacturing completes for a product, the finished-good stock increases.
 * Recalculate demand for all active waves that contain that product.
 *
 * This affects material coverage (stock changed) and manufacturing demand
 * (completed_qty increases). We do a targeted product-level refresh.
 */
final class ManufacturingCompletedListener
{
    public function __construct(
        private readonly DemandProjectionBuilder $builder,
    ) {}

    public function handle(ManufacturingJobCompletedEvent $event): void
    {
        // Find all active waves that have this product in their demand projections.
        $waveIds = DB::table('wave_product_demand')
            ->where('product_id', $event->productId)
            ->pluck('preparation_wave_id')
            ->all();

        foreach ($waveIds as $waveId) {
            $wave = PreparationWave::find($waveId);

            if ($wave === null) {
                continue;
            }

            $this->builder->buildForProducts($wave, [$event->productId], 'manufacturing_completed');
        }
    }
}
