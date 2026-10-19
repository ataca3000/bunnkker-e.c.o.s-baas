<?php

declare(strict_types=1);

namespace Modules\Operations\DemandAnalysis\Application\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;

/**
 * Derives wave-level KPI summary from the already-persisted demand read models.
 * Always a full recalculation — there is only one KPI row per wave.
 */
final class WaveKpiCalculator
{
    /**
     * @return array<string, mixed>
     */
    public function calculate(PreparationWave $wave): array
    {
        // Product stats
        $productStats = DB::table('wave_product_demand')
            ->where('preparation_wave_id', $wave->id)
            ->selectRaw('
                COUNT(*)                                     AS products_count,
                SUM(CASE WHEN remaining_qty <= 0 THEN 1 ELSE 0 END) AS prepared_count,
                SUM(CASE WHEN remaining_qty  > 0 THEN 1 ELSE 0 END) AS remaining_count,
                COALESCE(SUM(required_qty), 0)              AS total_required,
                COALESCE(SUM(prepared_qty), 0)              AS total_prepared
            ')
            ->first();

        // Material stats
        $materialStats = DB::table('wave_material_demand')
            ->where('preparation_wave_id', $wave->id)
            ->selectRaw('
                COUNT(*)                                                AS materials_count,
                SUM(CASE WHEN missing_qty > 0 THEN 1 ELSE 0 END)       AS missing_materials_count
            ')
            ->first();

        $productsCount = (int) ($productStats->products_count ?? 0);
        $preparedCount = (int) ($productStats->prepared_count ?? 0);
        $remainingCount = (int) ($productStats->remaining_count ?? 0);
        $totalRequired = (float) ($productStats->total_required ?? 0.0);
        $totalPrepared = (float) ($productStats->total_prepared ?? 0.0);
        $materialsCount = (int) ($materialStats->materials_count ?? 0);
        $missingMaterialsCount = (int) ($materialStats->missing_materials_count ?? 0);

        $completionPct = $totalRequired > 0.0
            ? round(($totalPrepared / $totalRequired) * 100.0, 2)
            : 0.0;

        $now = now()->toDateTimeString();

        return [
            'id' => Str::uuid()->toString(),
            'company_id' => $wave->company_id,
            'warehouse_id' => $wave->warehouse_id,
            'preparation_wave_id' => $wave->id,
            'orders_count' => $wave->orders_count ?? 0,
            'products_count' => $productsCount,
            'materials_count' => $materialsCount,
            'missing_materials_count' => $missingMaterialsCount,
            'prepared_count' => $preparedCount,
            'remaining_count' => $remainingCount,
            'completion_pct' => $completionPct,
            // Exposed for wave header sync — NOT stored in wave_kpis table
            '_total_units_required' => $totalRequired,
            '_total_units_prepared' => $totalPrepared,
            'last_calculated_at' => $now,
            'created_at' => $now,
            'updated_at' => $now,
        ];
    }
}
