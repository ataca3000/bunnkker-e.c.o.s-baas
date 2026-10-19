<?php

declare(strict_types=1);

namespace Modules\Operations\DemandAnalysis\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Modules\Operations\DemandAnalysis\Application\Services\DemandReadRepository;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;

final class WaveDemandController extends Controller
{
    use HasApiResponse;

    public function __construct(private readonly DemandReadRepository $repository) {}

    private function findWave(string $waveId, string $companyId): PreparationWave
    {
        return PreparationWave::where('id', $waveId)
            ->where('company_id', $companyId)
            ->firstOrFail();
    }

    public function kpis(Request $request, string $waveId): JsonResponse
    {
        $wave = $this->findWave($waveId, $request->user()->company_id);
        $kpi = $this->repository->getWaveKpis($wave->id);

        if (! $kpi) {
            return $this->success([
                'preparation_wave_id' => $wave->id,
                'orders_count' => $wave->orders_count,
                'products_count' => 0,
                'materials_count' => 0,
                'missing_materials_count' => 0,
                'prepared_count' => 0,
                'remaining_count' => 0,
                'completion_pct' => 0.0,
                'last_calculated_at' => null,
            ]);
        }

        return $this->success([
            'preparation_wave_id' => $kpi->preparation_wave_id,
            'orders_count' => $kpi->orders_count,
            'products_count' => $kpi->products_count,
            'materials_count' => $kpi->materials_count,
            'missing_materials_count' => $kpi->missing_materials_count,
            'prepared_count' => $kpi->prepared_count,
            'remaining_count' => $kpi->remaining_count,
            'completion_pct' => (float) $kpi->completion_pct,
            'last_calculated_at' => $kpi->last_calculated_at?->toIso8601String(),
        ]);
    }

    public function productDemand(Request $request, string $waveId): JsonResponse
    {
        $wave = $this->findWave($waveId, $request->user()->company_id);
        $items = $this->repository->getProductDemand($wave->id);

        return $this->success($items->map(fn ($i) => [
            'id' => $i->id,
            'product_id' => $i->product_id,
            'product_name' => $i->product_name,
            'product_sku' => $i->product_sku,
            'required_qty' => (float) $i->required_qty,
            'prepared_qty' => (float) $i->prepared_qty,
            'remaining_qty' => (float) $i->remaining_qty,
            'orders_count' => (int) $i->orders_count,
            'completion_pct' => (float) $i->completion_pct,
            'last_calculated_at' => $i->last_calculated_at?->toIso8601String(),
        ])->values()->all());
    }

    public function materialDemand(Request $request, string $waveId): JsonResponse
    {
        $wave = $this->findWave($waveId, $request->user()->company_id);
        $items = $this->repository->getMaterialDemand($wave->id);

        return $this->success($items->map(fn ($i) => [
            'id' => $i->id,
            'material_id' => $i->material_id,
            'material_name' => $i->material_name,
            'material_sku' => $i->material_sku,
            'required_qty' => (float) $i->required_qty,
            'available_qty' => (float) $i->available_qty,
            'reserved_qty' => (float) $i->reserved_qty,
            'expected_today' => (float) $i->expected_today,
            'in_transit_qty' => (float) $i->in_transit_qty,
            'missing_qty' => (float) $i->missing_qty,
            'coverage_pct' => (float) $i->coverage_pct,
            'last_calculated_at' => $i->last_calculated_at?->toIso8601String(),
        ])->values()->all());
    }

    public function missingMaterials(Request $request, string $waveId): JsonResponse
    {
        $wave = $this->findWave($waveId, $request->user()->company_id);
        $items = $this->repository->getMissingMaterials($wave->id);

        return $this->success($items->map(fn ($i) => [
            'id' => $i->id,
            'material_id' => $i->material_id,
            'material_name' => $i->material_name,
            'missing_qty' => (float) $i->missing_qty,
            'affected_orders_count' => (int) $i->affected_orders_count,
            'priority' => $i->priority?->value ?? $i->priority,
            'procurement_status' => $i->procurement_status,
            'last_calculated_at' => $i->last_calculated_at?->toIso8601String(),
        ])->values()->all());
    }

    public function manufacturingDemand(Request $request, string $waveId): JsonResponse
    {
        $wave = $this->findWave($waveId, $request->user()->company_id);
        $items = $this->repository->getManufacturingDemand($wave->id);

        return $this->success($items->map(fn ($i) => [
            'id' => $i->id,
            'product_id' => $i->product_id,
            'product_name' => $i->product_name,
            'required_qty' => (float) $i->required_qty,
            'planned_qty' => (float) $i->planned_qty,
            'manufacturing_qty' => (float) $i->manufacturing_qty,
            'completed_qty' => (float) $i->completed_qty,
            'remaining_qty' => (float) $i->remaining_qty,
            'last_calculated_at' => $i->last_calculated_at?->toIso8601String(),
        ])->values()->all());
    }

    public function waveOrders(Request $request, string $waveId): JsonResponse
    {
        $wave = $this->findWave($waveId, $request->user()->company_id);
        $orders = DB::table('preparation_wave_orders')
            ->where('preparation_wave_id', $wave->id)
            ->orderBy('added_at', 'desc')
            ->get();

        return $this->success($orders->map(fn ($o) => [
            'id' => $o->id,
            'order_id' => $o->order_id,
            'order_number' => $o->order_number,
            'customer_name_snapshot' => $o->customer_name_snapshot,
            'delivery_zone_snapshot' => $o->delivery_zone_snapshot ?? null,
            'governorate_snapshot' => $o->governorate_snapshot ?? null,
            'zone_code_snapshot' => $o->zone_code_snapshot ?? null,
            'preparation_priority' => $o->preparation_priority ?? 5,
            'is_paid' => (bool) ($o->is_paid ?? false),
            'added_at' => $o->added_at,
        ])->values()->all());
    }
}
