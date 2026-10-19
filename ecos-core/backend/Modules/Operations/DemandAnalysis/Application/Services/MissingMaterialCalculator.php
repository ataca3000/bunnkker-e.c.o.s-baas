<?php

declare(strict_types=1);

namespace Modules\Operations\DemandAnalysis\Application\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Modules\Operations\DemandAnalysis\Domain\Enums\MaterialPriority;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;

/**
 * Derives missing-material records from the already-calculated material demand.
 *
 * Rule: shortage = max(0, required – available). Negative shortages are never produced.
 * Affected-orders count is derived by traversing BOM backwards from material → product → orders.
 */
final class MissingMaterialCalculator
{
    /**
     * @param  list<string>|null  $affectedMaterialIds  Null = all materials for wave.
     * @return list<array<string, mixed>>
     */
    public function calculate(PreparationWave $wave, ?array $affectedMaterialIds = null): array
    {
        $query = DB::table('wave_material_demand')
            ->where('preparation_wave_id', $wave->id)
            ->where('missing_qty', '>', 0);

        if ($affectedMaterialIds !== null && count($affectedMaterialIds) > 0) {
            $query->whereIn('material_id', $affectedMaterialIds);
        }

        $shortages = $query
            ->select(['material_id', 'material_name', 'missing_qty', 'required_qty'])
            ->get();

        if ($shortages->isEmpty()) {
            return [];
        }

        $materialIds = $shortages->pluck('material_id')->all();

        // Count affected orders per material: orders in wave that contain a
        // product whose BOM uses this material.
        $affectedCounts = $this->countAffectedOrders($wave->id, $materialIds);

        $now = now()->toDateTimeString();
        $rows = [];

        foreach ($shortages as $row) {
            $missingQty = (float) $row->missing_qty;
            $requiredQty = (float) $row->required_qty;
            $priority = MaterialPriority::fromShortageRatio($missingQty, $requiredQty);
            $affectedCount = $affectedCounts[$row->material_id] ?? 0;

            $rows[] = [
                'id' => Str::uuid()->toString(),
                'company_id' => $wave->company_id,
                'warehouse_id' => $wave->warehouse_id,
                'preparation_wave_id' => $wave->id,
                'material_id' => $row->material_id,
                'material_name' => $row->material_name,
                'missing_qty' => round($missingQty, 4),
                'affected_orders_count' => $affectedCount,
                'priority' => $priority->value,
                'procurement_status' => null,
                'last_calculated_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        return $rows;
    }

    /**
     * Return a map of material_id → affected_order_count for the given wave.
     *
     * @param  list<string>  $materialIds
     * @return array<string, int>
     */
    private function countAffectedOrders(string $waveId, array $materialIds): array
    {
        // material → finished products (via BOM) → orders in this wave
        $rows = DB::table('bill_of_material_lines as boml')
            ->join('bills_of_materials as bom', 'bom.id', '=', 'boml.bom_id')
            ->join('order_lines as ol', 'ol.product_id', '=', 'bom.product_id')
            ->join('preparation_wave_orders as pwo', function ($join) use ($waveId) {
                $join->on('pwo.order_id', '=', 'ol.order_id')
                    ->where('pwo.preparation_wave_id', $waveId);
            })
            ->where('bom.is_active', true)
            ->whereIn('boml.raw_material_id', $materialIds)
            ->selectRaw('boml.raw_material_id AS material_id, COUNT(DISTINCT pwo.order_id) AS order_count')
            ->groupBy('boml.raw_material_id')
            ->get();

        $map = [];
        foreach ($rows as $row) {
            $map[$row->material_id] = (int) $row->order_count;
        }

        return $map;
    }
}
