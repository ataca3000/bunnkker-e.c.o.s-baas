<?php

declare(strict_types=1);

namespace Modules\Operations\DemandAnalysis\Application\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;

/**
 * Explodes product demand through BOMs to derive raw-material requirements.
 *
 * Reads product demand from wave_product_demand (already calculated).
 * Joins bills_of_materials + bill_of_material_lines + inventory_items in DB.
 * Never loads full collections into PHP memory.
 *
 * Incremental mode: pass $affectedProductIds to re-explode only those products.
 * All other material rows are left untouched (the upsert only updates matched keys).
 */
final class MaterialDemandCalculator
{
    /**
     * @param  list<string>|null  $affectedProductIds  Null = full recalculation.
     * @return list<array<string, mixed>>
     */
    public function calculate(PreparationWave $wave, ?array $affectedProductIds = null): array
    {
        // ── Step 1: load the relevant product demand rows ──────────────────────
        $productQuery = DB::table('wave_product_demand')
            ->where('preparation_wave_id', $wave->id)
            ->where('required_qty', '>', 0)
            ->select(['product_id', 'required_qty']);

        if ($affectedProductIds !== null && count($affectedProductIds) > 0) {
            $productQuery->whereIn('product_id', $affectedProductIds);
        }

        $productDemand = $productQuery->get()->keyBy('product_id');

        if ($productDemand->isEmpty()) {
            return [];
        }

        $productIds = $productDemand->keys()->all();

        // ── Step 2: explode BOMs ───────────────────────────────────────────────
        // Only active BOMs. Multiple versions may exist; max bom_version_number wins (via subquery).
        $activeBomIds = DB::table('bills_of_materials as bom')
            ->whereIn('bom.product_id', $productIds)
            ->where('bom.is_active', true)
            ->select('bom.id', 'bom.product_id');

        $bomLines = DB::table('bill_of_material_lines as boml')
            ->joinSub($activeBomIds, 'bom', 'bom.id', '=', 'boml.bom_id')
            ->join('products as p', 'p.id', '=', 'boml.raw_material_id')
            ->select([
                'bom.product_id                AS finished_product_id',
                'boml.raw_material_id          AS material_id',
                'p.name                        AS material_name',
                'p.sku                         AS material_sku',
                DB::raw('CAST(boml.quantity AS DECIMAL(15,4))          AS qty_per_unit'),
                DB::raw('COALESCE(CAST(boml.waste_percentage AS DECIMAL(15,4)), 0) AS waste_pct'),
            ])
            ->get();

        if ($bomLines->isEmpty()) {
            return [];
        }

        // ── Step 3: aggregate required quantities per material ────────────────
        /** @var array<string, array{material_id:string, material_name:string, material_sku:string|null, required_qty:float}> $aggregates */
        $aggregates = [];

        foreach ($bomLines as $line) {
            $productRequiredQty = (float) ($productDemand[$line->finished_product_id]->required_qty ?? 0.0);
            $qtyPerUnit = (float) $line->qty_per_unit;
            $wasteFactor = 1.0 + ((float) $line->waste_pct / 100.0);
            $materialRequired = $productRequiredQty * $qtyPerUnit * $wasteFactor;

            if (! isset($aggregates[$line->material_id])) {
                $aggregates[$line->material_id] = [
                    'material_id' => $line->material_id,
                    'material_name' => $line->material_name,
                    'material_sku' => $line->material_sku,
                    'required_qty' => 0.0,
                ];
            }

            $aggregates[$line->material_id]['required_qty'] += $materialRequired;
        }

        // ── Step 4: fetch stock levels for all materials in one query ─────────
        $materialIds = array_keys($aggregates);

        $stockLevels = DB::table('inventory_items')
            ->where('warehouse_id', $wave->warehouse_id)
            ->whereIn('product_id', $materialIds)
            ->selectRaw('product_id, on_hand_qty, reserved_qty')
            ->get()
            ->keyBy('product_id');

        // ── Step 5: build result rows ─────────────────────────────────────────
        $now = now()->toDateTimeString();

        $rows = [];

        foreach ($aggregates as $agg) {
            $required = round($agg['required_qty'], 4);
            $stockRow = $stockLevels[$agg['material_id']] ?? null;
            $onHand = $stockRow ? (float) $stockRow->on_hand_qty : 0.0;
            $reserved = $stockRow ? (float) $stockRow->reserved_qty : 0.0;
            // Use physical on-hand stock for deterministic demand planning.
            // Order-level soft reservations are volatile (change with order status transitions)
            // and should not affect manufacturing demand calculations.
            $available = max(0.0, $onHand);
            $missing = max(0.0, $required - $available);
            $coveragePct = $required > 0.0
                ? min(100.0, round(($available / $required) * 100.0, 2))
                : 100.0;

            $rows[] = [
                'id' => Str::uuid()->toString(),
                'company_id' => $wave->company_id,
                'warehouse_id' => $wave->warehouse_id,
                'preparation_wave_id' => $wave->id,
                'material_id' => $agg['material_id'],
                'material_name' => $agg['material_name'],
                'material_sku' => $agg['material_sku'] ?? null,
                'required_qty' => $required,
                'available_qty' => round($available, 4),
                'reserved_qty' => round($reserved, 4),
                'expected_today' => 0.0,
                'in_transit_qty' => 0.0,
                'missing_qty' => round($missing, 4),
                'coverage_pct' => $coveragePct,
                'data_hash' => md5($wave->id.$agg['material_id'].$required.$available),
                'last_calculated_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        return $rows;
    }
}
