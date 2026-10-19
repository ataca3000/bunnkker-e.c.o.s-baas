<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\Services;

use Illuminate\Support\Facades\DB;

/**
 * Material Requirements Planning service.
 *
 * Calculates material requirements for a set of wave items by exploding
 * each product's Bill of Materials and comparing against available stock.
 *
 * CONTRACT: read-only, no writes, no events. Returns pure data.
 */
final class MRPCalculationService
{
    /**
     * @param  list<object{id:string,product_id:string,quantity_required:float}>  $waveItems
     * @return list<array{raw_material_id:string,material_name:string,unit:string,quantity_required:float,quantity_available:float,shortage:bool,shortage_amount:float,quantity_to_purchase:float}>
     */
    public function calculate(string $companyId, string $warehouseId, array $waveItems): array
    {
        $aggregated = [];

        foreach ($waveItems as $item) {
            $lines = DB::table('bill_of_material_lines as bl')
                ->join('bill_of_materials as bom', function ($j) use ($item) {
                    $j->on('bom.id', '=', 'bl.bill_of_material_id')
                        ->where('bom.product_id', '=', $item->product_id)
                        ->where('bom.is_active', '=', true);
                })
                ->join('products as rm', 'rm.id', '=', 'bl.raw_material_id')
                ->select(
                    'bl.raw_material_id',
                    'rm.name as material_name',
                    'rm.sku as material_unit',
                    'bl.quantity_per_unit',
                    'bl.waste_factor',
                )
                ->get();

            foreach ($lines as $line) {
                $required = $item->quantity_required
                    * (float) $line->quantity_per_unit
                    * (1 + ((float) ($line->waste_factor ?? 0)));

                $materialId = $line->raw_material_id;

                if (! isset($aggregated[$materialId])) {
                    $available = (float) DB::table('inventory_items')
                        ->where('product_id', $materialId)
                        ->where('company_id', $companyId)
                        ->sum('on_hand_qty');

                    $aggregated[$materialId] = [
                        'raw_material_id' => $materialId,
                        'material_name' => $line->material_name,
                        'unit' => $line->material_unit,
                        'quantity_required' => 0.0,
                        'quantity_available' => $available,
                        'shortage' => false,
                        'shortage_amount' => 0.0,
                        'quantity_to_purchase' => 0.0,
                    ];
                }

                $aggregated[$materialId]['quantity_required'] += $required;

                $totalRequired = $aggregated[$materialId]['quantity_required'];
                $available = $aggregated[$materialId]['quantity_available'];
                $shortage = $available < $totalRequired;

                $aggregated[$materialId]['shortage'] = $shortage;
                $aggregated[$materialId]['shortage_amount'] = $shortage ? max(0, $totalRequired - $available) : 0.0;
                $aggregated[$materialId]['quantity_to_purchase'] = $aggregated[$materialId]['shortage_amount'];
            }
        }

        return array_values($aggregated);
    }

    /**
     * Check whether a specific wave item has a missing recipe.
     */
    public function hasMissingRecipe(string $productId): bool
    {
        return ! DB::table('bill_of_materials')
            ->where('product_id', $productId)
            ->where('is_active', true)
            ->exists();
    }
}
