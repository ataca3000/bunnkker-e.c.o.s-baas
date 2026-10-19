<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Modules\Operations\Preparation\Domain\Models\PreparationProductionRequirement;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;

/**
 * Production Requirements Planning service.
 *
 * Checks finished goods inventory for each wave item and creates
 * PreparationProductionRequirement records for products that need manufacturing.
 *
 * Publishes manufacturing.production_job.requested for items with quantity_to_manufacture > 0.
 */
final class PRPCalculationService
{
    /**
     * Run PRP for all wave items and create production requirement records.
     */
    public function calculate(PreparationWave $wave, string $actorId): void
    {
        $items = $wave->waveItems()->get();

        foreach ($items as $item) {
            $availableFinished = (float) DB::table('inventory_items')
                ->where('product_id', $item->product_id)
                ->where('company_id', $wave->company_id)
                ->sum('on_hand_qty');

            $quantityToManufacture = max(0.0, $item->quantity_required - $availableFinished);

            $existing = PreparationProductionRequirement::where('preparation_wave_id', $wave->id)
                ->where('product_id', $item->product_id)
                ->first();

            if ($existing) {
                $existing->update([
                    'quantity_to_produce' => $quantityToManufacture,
                    'updated_by' => $actorId,
                ]);
            } else {
                PreparationProductionRequirement::create([
                    'id' => Str::uuid()->toString(),
                    'company_id' => $wave->company_id,
                    'preparation_wave_id' => $wave->id,
                    'product_id' => $item->product_id,
                    'sku_snapshot' => $item->sku_snapshot,
                    'quantity_required' => $item->quantity_required,
                    'quantity_to_produce' => $quantityToManufacture,
                    'quantity_produced' => 0,
                    'status' => $quantityToManufacture > 0 ? 'pending' : 'ready',
                    'created_by' => $actorId,
                    'updated_by' => $actorId,
                ]);
            }

            if ($quantityToManufacture > 0) {
                // Publish manufacturing.production_job.requested event for Manufacturing OS to consume.
                // Manufacturing OS creates a job and links back via manufacturing.production_job.created.
                event(new \Modules\Operations\Preparation\Domain\Events\ProductionJobRequested(
                    waveId: $wave->id,
                    companyId: $wave->company_id,
                    productId: $item->product_id,
                    quantityToManufacture: $quantityToManufacture,
                    priority: 1,
                    requiredByDate: $wave->planning_date->toDateString(),
                ));
            }
        }
    }
}
