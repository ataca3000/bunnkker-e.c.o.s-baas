<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

final class PreparationAnalyticsController extends Controller
{
    use HasApiResponse;

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'from_date' => ['required', 'date_format:Y-m-d'],
            'to_date' => ['required', 'date_format:Y-m-d', 'after_or_equal:from_date'],
            'warehouse_id' => ['nullable', 'uuid'],
        ]);

        $fromDate = $request->query('from_date');
        $toDate = $request->query('to_date');
        $companyId = $request->user()->company_id;
        $warehouseId = $request->query('warehouse_id');

        $daysDiff = (int) \Carbon\Carbon::parse($fromDate)->diffInDays(\Carbon\Carbon::parse($toDate));
        if ($daysDiff > 90) {
            abort(422, 'Date range cannot exceed 90 days.');
        }

        $cacheKey = "prep_analytics_{$companyId}_{$warehouseId}_{$fromDate}_{$toDate}";

        $data = Cache::remember($cacheKey, 300, function () use ($companyId, $fromDate, $toDate, $warehouseId) {
            return $this->buildAnalytics($companyId, $fromDate, $toDate, $warehouseId);
        });

        return $this->success($data);
    }

    /** @return array<string, mixed> */
    private function buildAnalytics(string $companyId, string $fromDate, string $toDate, ?string $warehouseId): array
    {
        $baseQuery = DB::table('preparation_waves')
            ->where('company_id', $companyId)
            ->whereBetween('planning_date', [$fromDate, $toDate])
            ->when($warehouseId, fn ($q) => $q->where('warehouse_id', $warehouseId));

        $summary = (clone $baseQuery)->selectRaw('
            COUNT(*) as waves_created,
            SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as waves_completed,
            SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as waves_cancelled,
            AVG(CASE WHEN status = ? AND started_at IS NOT NULL AND completed_at IS NOT NULL
                THEN EXTRACT(EPOCH FROM (completed_at - started_at)) / 60
                ELSE NULL END) as avg_completion_time_minutes,
            AVG(CASE WHEN status = ? AND total_units_required > 0
                THEN (total_units_prepared / total_units_required) * 100
                ELSE NULL END) as avg_completion_pct,
            SUM(CASE WHEN shortage_detected = true THEN 1 ELSE 0 END) as shortage_count,
            SUM(total_units_prepared) as total_units_prepared
        ', ['completed', 'cancelled', 'completed', 'completed'])
            ->first();

        $wavesCreated = (int) ($summary->waves_created ?? 0);
        $shortageRate = $wavesCreated > 0
            ? round(((int) ($summary->shortage_count ?? 0) / $wavesCreated) * 100, 1)
            : 0.0;

        $daily = (clone $baseQuery)->selectRaw('
            DATE(planning_date) as date,
            COUNT(*) as waves,
            SUM(total_units_prepared) as units_prepared,
            AVG(CASE WHEN started_at IS NOT NULL AND completed_at IS NOT NULL
                THEN TIMESTAMPDIFF(SECOND, started_at, completed_at) / 60
                ELSE NULL END) as avg_minutes
        ')
            ->groupBy('planning_date')
            ->orderBy('planning_date')
            ->get();

        $topShorted = DB::table('preparation_wave_items as pwi')
            ->join('preparation_waves as pw', 'pw.id', '=', 'pwi.preparation_wave_id')
            ->where('pw.company_id', $companyId)
            ->whereBetween('pw.planning_date', [$fromDate, $toDate])
            ->when($warehouseId, fn ($q) => $q->where('pw.warehouse_id', $warehouseId))
            ->where('pwi.quantity_short', '>', 0)
            ->selectRaw('
                pwi.product_id,
                pwi.sku_snapshot as sku,
                COUNT(*) as shortage_occurrences,
                AVG((pwi.quantity_short / pwi.quantity_required) * 100) as avg_shortage_pct
            ')
            ->groupBy('pwi.product_id', 'pwi.sku_snapshot')
            ->orderByDesc('shortage_occurrences')
            ->limit(10)
            ->get();

        return [
            'period' => ['from' => $fromDate, 'to' => $toDate],
            'summary' => [
                'waves_created' => $wavesCreated,
                'waves_completed' => (int) ($summary->waves_completed ?? 0),
                'waves_cancelled' => (int) ($summary->waves_cancelled ?? 0),
                'avg_completion_time_minutes' => round((float) ($summary->avg_completion_time_minutes ?? 0), 0),
                'avg_completion_pct' => round((float) ($summary->avg_completion_pct ?? 0), 1),
                'shortage_rate_pct' => $shortageRate,
                'total_units_prepared' => (float) ($summary->total_units_prepared ?? 0),
            ],
            'daily' => $daily->map(fn ($d) => [
                'date' => $d->date,
                'waves' => (int) $d->waves,
                'units_prepared' => (float) ($d->units_prepared ?? 0),
                'avg_minutes' => round((float) ($d->avg_minutes ?? 0), 0),
            ])->values()->all(),
            'top_shorted_products' => $topShorted->map(fn ($p) => [
                'product_id' => $p->product_id,
                'sku' => $p->sku,
                'shortage_occurrences' => (int) $p->shortage_occurrences,
                'avg_shortage_pct' => round((float) $p->avg_shortage_pct, 1),
            ])->values()->all(),
        ];
    }
}
