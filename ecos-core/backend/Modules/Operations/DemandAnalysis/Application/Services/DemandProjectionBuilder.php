<?php

declare(strict_types=1);

namespace Modules\Operations\DemandAnalysis\Application\Services;

use Illuminate\Support\Facades\DB;
use Modules\Operations\DemandAnalysis\Domain\Events\MaterialDemandUpdated;
use Modules\Operations\DemandAnalysis\Domain\Events\MissingMaterialsUpdated;
use Modules\Operations\DemandAnalysis\Domain\Events\ProductDemandUpdated;
use Modules\Operations\DemandAnalysis\Domain\Events\WaveDemandUpdated;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;

/**
 * Orchestrates the multi-step demand projection pipeline for a wave.
 *
 * Full recalculation:   products → materials → missing → KPIs → events
 * Incremental refresh:  only affected products/materials are recalculated;
 *                       unaffected rows are untouched.
 *
 * Events are published after each layer so downstream listeners can react
 * to partial updates as they arrive.
 */
final class DemandProjectionBuilder
{
    public function __construct(
        private readonly ProductDemandCalculator $productCalc,
        private readonly MaterialDemandCalculator $materialCalc,
        private readonly MissingMaterialCalculator $missingCalc,
        private readonly WaveKpiCalculator $kpiCalc,
        private readonly DemandReadRepository $repository,
    ) {}

    // ── Full recalculation ────────────────────────────────────────────────────

    public function buildFull(PreparationWave $wave, string $trigger = 'full_refresh'): void
    {
        // Layer 1 – product demand
        $productRows = $this->productCalc->calculate($wave);
        $this->repository->upsertProductDemand($productRows);

        event(new ProductDemandUpdated(
            $wave->id,
            $wave->company_id,
            $wave->warehouse_id,
            count($productRows),
            $trigger,
        ));

        // Layer 2 – material demand (reads product demand from DB)
        $materialRows = $this->materialCalc->calculate($wave);
        $this->repository->upsertMaterialDemand($materialRows);

        // Layer 3 – missing materials
        $this->repository->deleteResolvedMissingMaterials($wave->id);
        $missingRows = $this->missingCalc->calculate($wave);
        $this->repository->upsertMissingMaterials($missingRows);

        $missingMaterialIds = array_column($missingRows, 'material_id');
        $hasCritical = count(array_filter($missingRows, fn ($r) => $r['priority'] === 'critical')) > 0;

        event(new MaterialDemandUpdated(
            $wave->id,
            $wave->company_id,
            $wave->warehouse_id,
            count($materialRows),
            count($missingRows),
            $trigger,
        ));

        event(new MissingMaterialsUpdated(
            $wave->id,
            $wave->company_id,
            $wave->warehouse_id,
            count($missingRows),
            $hasCritical,
            $trigger,
        ));

        // Layer 4 – KPIs (reads from DB)
        $kpiData = $this->kpiCalc->calculate($wave);
        $this->repository->upsertWaveKpis($kpiData);
        $this->syncWaveHeader($wave->id, $kpiData);

        event(new WaveDemandUpdated(
            $wave->id,
            $wave->company_id,
            $wave->warehouse_id,
            $kpiData['orders_count'],
            $kpiData['products_count'],
            $kpiData['materials_count'],
            $kpiData['missing_materials_count'],
            $kpiData['completion_pct'],
            $trigger,
        ));
    }

    // ── Incremental refresh (order-level) ─────────────────────────────────────

    /**
     * Recalculate only the products that belong to the given orders.
     * Unaffected products/materials remain unchanged.
     *
     * @param  list<string>  $affectedOrderIds
     */
    public function buildIncremental(PreparationWave $wave, array $affectedOrderIds, string $trigger = 'incremental'): void
    {
        if (empty($affectedOrderIds)) {
            return;
        }

        // Derive affected product IDs from order lines (no model load needed).
        $affectedProductIds = $this->productCalc->productIdsForOrders($affectedOrderIds);

        if (empty($affectedProductIds)) {
            $this->refreshKpis($wave, $trigger);

            return;
        }

        $this->buildForProducts($wave, $affectedProductIds, $trigger);
    }

    /**
     * Recalculate only the given product rows (and their derived materials).
     *
     * @param  list<string>  $productIds
     */
    public function buildForProducts(PreparationWave $wave, array $productIds, string $trigger = 'product_refresh'): void
    {
        // Layer 1
        $productRows = $this->productCalc->calculate($wave, $productIds);
        $this->repository->upsertProductDemand($productRows);

        event(new ProductDemandUpdated(
            $wave->id,
            $wave->company_id,
            $wave->warehouse_id,
            count($productRows),
            $trigger,
        ));

        // Layer 2 — re-explode only affected products
        $materialRows = $this->materialCalc->calculate($wave, $productIds);
        $this->repository->upsertMaterialDemand($materialRows);

        // Layer 3 — re-check shortages for affected materials only
        $affectedMaterialIds = array_column($materialRows, 'material_id');
        $this->repository->deleteResolvedMissingMaterials($wave->id);
        $missingRows = $this->missingCalc->calculate($wave, $affectedMaterialIds ?: null);
        $this->repository->upsertMissingMaterials($missingRows);

        $hasCritical = count(array_filter($missingRows, fn ($r) => $r['priority'] === 'critical')) > 0;

        event(new MaterialDemandUpdated(
            $wave->id,
            $wave->company_id,
            $wave->warehouse_id,
            count($materialRows),
            count($missingRows),
            $trigger,
        ));

        event(new MissingMaterialsUpdated(
            $wave->id,
            $wave->company_id,
            $wave->warehouse_id,
            count($missingRows),
            $hasCritical,
            $trigger,
        ));

        $this->refreshKpis($wave, $trigger);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function refreshKpis(PreparationWave $wave, string $trigger): void
    {
        $kpiData = $this->kpiCalc->calculate($wave);
        $this->repository->upsertWaveKpis($kpiData);
        $this->syncWaveHeader($wave->id, $kpiData);

        event(new WaveDemandUpdated(
            $wave->id,
            $wave->company_id,
            $wave->warehouse_id,
            $kpiData['orders_count'],
            $kpiData['products_count'],
            $kpiData['materials_count'],
            $kpiData['missing_materials_count'],
            $kpiData['completion_pct'],
            $trigger,
        ));
    }

    private function syncWaveHeader(string $waveId, array $kpiData): void
    {
        DB::table('preparation_waves')
            ->where('id', $waveId)
            ->update([
                'products_count' => $kpiData['products_count'],
                'total_units_required' => $kpiData['_total_units_required'] ?? 0,
                'total_units_prepared' => $kpiData['_total_units_prepared'] ?? 0,
                'updated_at' => now(),
            ]);
    }
}
