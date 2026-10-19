<?php

declare(strict_types=1);

namespace Modules\Operations\DemandAnalysis\Application\Services;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Modules\Operations\DemandAnalysis\Domain\Models\WaveKpi;
use Modules\Operations\DemandAnalysis\Domain\Models\WaveManufacturingDemand;
use Modules\Operations\DemandAnalysis\Domain\Models\WaveMaterialDemand;
use Modules\Operations\DemandAnalysis\Domain\Models\WaveMissingMaterial;
use Modules\Operations\DemandAnalysis\Domain\Models\WaveProductDemand;

/**
 * Persistence layer for all demand read models.
 *
 * The engine calls upsert methods after calculation; the Preparation Workspace
 * calls read methods to render UI. Caching is controlled here — all engine
 * services remain cache-agnostic.
 *
 * Upserts use PostgreSQL ON CONFLICT to guarantee idempotency: identical inputs
 * always produce identical output regardless of how many times they are applied.
 */
final class DemandReadRepository
{
    // ── Reads ─────────────────────────────────────────────────────────────────

    /** @return Collection<int, WaveProductDemand> */
    public function getProductDemand(string $waveId): Collection
    {
        return WaveProductDemand::where('preparation_wave_id', $waveId)
            ->orderByDesc('required_qty')
            ->get();
    }

    /** @return Collection<int, WaveMaterialDemand> */
    public function getMaterialDemand(string $waveId): Collection
    {
        return WaveMaterialDemand::where('preparation_wave_id', $waveId)
            ->orderByDesc('required_qty')
            ->get();
    }

    /** @return Collection<int, WaveMissingMaterial> */
    public function getMissingMaterials(string $waveId): Collection
    {
        return WaveMissingMaterial::where('preparation_wave_id', $waveId)
            ->orderByRaw("CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END")
            ->get();
    }

    /** @return Collection<int, WaveManufacturingDemand> */
    public function getManufacturingDemand(string $waveId): Collection
    {
        return WaveManufacturingDemand::where('preparation_wave_id', $waveId)
            ->orderByDesc('required_qty')
            ->get();
    }

    public function getWaveKpis(string $waveId): ?WaveKpi
    {
        return WaveKpi::where('preparation_wave_id', $waveId)->first();
    }

    // ── Writes ────────────────────────────────────────────────────────────────

    /**
     * @param  list<array<string, mixed>>  $rows
     */
    public function upsertProductDemand(array $rows): void
    {
        if (empty($rows)) {
            return;
        }

        // Chunk to avoid hitting parameter limits on large waves (1 M lines → many products).
        foreach (array_chunk($rows, 500) as $chunk) {
            DB::table('wave_product_demand')->upsert(
                $chunk,
                ['preparation_wave_id', 'product_id'],
                ['product_name', 'product_sku', 'required_qty', 'prepared_qty',
                    'remaining_qty', 'orders_count', 'completion_pct',
                    'data_hash', 'last_calculated_at', 'updated_at'],
            );
        }
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     */
    public function upsertMaterialDemand(array $rows): void
    {
        if (empty($rows)) {
            return;
        }

        foreach (array_chunk($rows, 500) as $chunk) {
            DB::table('wave_material_demand')->upsert(
                $chunk,
                ['preparation_wave_id', 'material_id'],
                ['material_name', 'material_sku', 'required_qty', 'available_qty',
                    'reserved_qty', 'expected_today', 'in_transit_qty',
                    'missing_qty', 'coverage_pct', 'data_hash', 'last_calculated_at', 'updated_at'],
            );
        }
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     */
    public function upsertMissingMaterials(array $rows): void
    {
        if (empty($rows)) {
            return;
        }

        foreach (array_chunk($rows, 500) as $chunk) {
            DB::table('wave_missing_materials')->upsert(
                $chunk,
                ['preparation_wave_id', 'material_id'],
                ['material_name', 'missing_qty', 'affected_orders_count',
                    'priority', 'procurement_status', 'last_calculated_at', 'updated_at'],
            );
        }
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     */
    public function upsertManufacturingDemand(array $rows): void
    {
        if (empty($rows)) {
            return;
        }

        foreach (array_chunk($rows, 500) as $chunk) {
            DB::table('wave_manufacturing_demand')->upsert(
                $chunk,
                ['preparation_wave_id', 'product_id'],
                ['product_name', 'required_qty', 'planned_qty', 'manufacturing_qty',
                    'completed_qty', 'remaining_qty', 'last_calculated_at', 'updated_at'],
            );
        }
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function upsertWaveKpis(array $data): void
    {
        // Strip meta-keys (underscore-prefixed) that are meant for callers but not DB columns.
        $row = array_filter($data, static fn ($k) => ! str_starts_with($k, '_'), ARRAY_FILTER_USE_KEY);

        DB::table('wave_kpis')->upsert(
            [$row],
            ['preparation_wave_id'],
            ['orders_count', 'products_count', 'materials_count', 'missing_materials_count',
                'prepared_count', 'remaining_count', 'completion_pct',
                'last_calculated_at', 'updated_at'],
        );
    }

    // ── Cleanup ───────────────────────────────────────────────────────────────

    /** Remove all demand projections for a wave (e.g. when wave is deleted). */
    public function clearWaveDemand(string $waveId): void
    {
        DB::table('wave_product_demand')->where('preparation_wave_id', $waveId)->delete();
        DB::table('wave_material_demand')->where('preparation_wave_id', $waveId)->delete();
        DB::table('wave_missing_materials')->where('preparation_wave_id', $waveId)->delete();
        DB::table('wave_manufacturing_demand')->where('preparation_wave_id', $waveId)->delete();
        DB::table('wave_kpis')->where('preparation_wave_id', $waveId)->delete();
    }

    /** Remove resolved shortages (materials where missing_qty is now 0). */
    public function deleteResolvedMissingMaterials(string $waveId): void
    {
        DB::table('wave_missing_materials')
            ->where('preparation_wave_id', $waveId)
            ->whereNotIn(
                'material_id',
                DB::table('wave_material_demand')
                    ->where('preparation_wave_id', $waveId)
                    ->where('missing_qty', '>', 0)
                    ->pluck('material_id'),
            )
            ->delete();
    }

    // ── Idempotency helpers ───────────────────────────────────────────────────

    /**
     * Check if a product demand row is stale (hash changed).
     * Used by callers that want to skip publishing events when data didn't change.
     */
    public function hasProductDemandChanged(string $waveId, string $productId, string $newHash): bool
    {
        $existing = DB::table('wave_product_demand')
            ->where('preparation_wave_id', $waveId)
            ->where('product_id', $productId)
            ->value('data_hash');

        return $existing !== $newHash;
    }
}
