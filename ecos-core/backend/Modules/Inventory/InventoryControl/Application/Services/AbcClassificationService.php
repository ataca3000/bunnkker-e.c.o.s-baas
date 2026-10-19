<?php

declare(strict_types=1);

namespace Modules\Inventory\InventoryControl\Application\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Inventory\CountSessions\Domain\Enums\CountSessionStatus;
use Modules\Inventory\InventoryControl\Domain\Enums\AbcClass;
use Modules\Inventory\InventoryControl\Domain\Models\CycleCountPlan;
use Modules\Inventory\InventoryControl\Domain\Models\InventoryAbcClassification;

/**
 * Implements Pareto ABC classification for inventory control.
 *
 * Classification rules:
 *   Class A — top 70 % of annual consumption value (count monthly)
 *   Class B — next 20 %  (count quarterly)
 *   Class C — bottom 10 % (count semi-annually)
 *
 * Consumption value is derived from inventory_layer_consumptions in the
 * past 12 months.  Products with no consumption history default to Class C.
 */
final class AbcClassificationService
{
    /**
     * Recalculate and persist ABC classifications for every product.
     *
     * @return array{total: int, A: int, B: int, C: int}
     */
    public function recalculate(): array
    {
        $cutoff = Carbon::now()->subYear();

        // 1. Aggregate consumption value per product (last 12 months)
        $rows = DB::table('inventory_layer_consumptions')
            ->where('created_at', '>=', $cutoff)
            ->selectRaw('product_id, COALESCE(SUM(total_cost), 0) as total_value')
            ->groupBy('product_id')
            ->orderByDesc('total_value')
            ->get();

        // 2. Also include all products that have never been consumed (value = 0)
        $consumedIds = $rows->pluck('product_id')->all();

        $unconsumable = DB::table('products')
            ->whereNotIn('id', $consumedIds)
            ->whereNull('deleted_at')
            ->select('id as product_id', DB::raw('0 as total_value'))
            ->get();

        $all = $rows->concat($unconsumable);

        $grandTotal = (float) $rows->sum('total_value');

        $counts = ['A' => 0, 'B' => 0, 'C' => 0];
        $cumulative = 0.0;
        $now = Carbon::now();

        foreach ($all as $row) {
            $value = (float) $row->total_value;
            $cumPct = $grandTotal > 0
                ? round(($cumulative + $value) / $grandTotal * 100, 4)
                : 100.0;
            $cumulative += $value;

            $class = match (true) {
                $grandTotal <= 0 => AbcClass::C,
                $cumPct <= 70.0 => AbcClass::A,
                $cumPct <= 90.0 => AbcClass::B,
                default => AbcClass::C,
            };

            // Upsert classification
            InventoryAbcClassification::query()->updateOrCreate(
                ['product_id' => $row->product_id],
                [
                    'classification' => $class,
                    'annual_consumption_value' => round($value, 2),
                    'cumulative_percentage' => round($cumPct, 4),
                    'calculated_at' => $now,
                ],
            );

            $counts[$class->value]++;

            // Update cycle count plan
            $this->upsertCycleCountPlan($row->product_id, $class, $now);
        }

        return ['total' => count($all), ...$counts];
    }

    private function upsertCycleCountPlan(string $productId, AbcClass $class, Carbon $now): void
    {
        $frequencyDays = $class->frequencyDays();

        // Last approved count date for this product (any warehouse)
        $lastCounted = DB::table('inventory_count_lines as icl')
            ->join('inventory_count_sessions as ics', 'ics.id', '=', 'icl.session_id')
            ->where('icl.product_id', $productId)
            ->whereNotNull('icl.counted_qty')
            ->where('ics.status', CountSessionStatus::Approved->value)
            ->max('ics.completed_at');

        $lastCountedDate = $lastCounted ? Carbon::parse($lastCounted)->toDateString() : null;
        $nextDueDate = $lastCountedDate
            ? Carbon::parse($lastCountedDate)->addDays($frequencyDays)->toDateString()
            : null;
        $isOverdue = $nextDueDate === null || Carbon::parse($nextDueDate)->isPast();

        CycleCountPlan::query()->updateOrCreate(
            ['product_id' => $productId],
            [
                'abc_class' => $class,
                'frequency_days' => $frequencyDays,
                'last_counted_at' => $lastCountedDate,
                'next_due_at' => $nextDueDate,
                'is_overdue' => $isOverdue,
            ],
        );
    }
}
