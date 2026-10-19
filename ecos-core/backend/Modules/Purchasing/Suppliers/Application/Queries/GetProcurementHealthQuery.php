<?php

declare(strict_types=1);

namespace Modules\Purchasing\Suppliers\Application\Queries;

use Illuminate\Support\Facades\DB;
use Modules\Purchasing\GoodsReceipts\Domain\Enums\GoodsReceiptStatus;
use Modules\Purchasing\Suppliers\Domain\Exceptions\SupplierNotFoundException;
use Modules\Purchasing\Suppliers\Domain\Models\Supplier;

/**
 * Computes a weighted Procurement Health Score (0–100) from PO/GR data.
 *
 * Weights are intentionally kept in this query class so they can be made
 * configurable per-company in a future iteration without touching the controller.
 */
final class GetProcurementHealthQuery
{
    /** @var array<string, float> */
    private const WEIGHTS = [
        'delivery_performance' => 0.25,
        'fill_rate' => 0.20,
        'price_stability' => 0.20,
        'activity' => 0.15,
        'financial_standing' => 0.10,
        'inventory_impact' => 0.10,
    ];

    /** @return array<string, mixed> */
    public function execute(string $supplierId): array
    {
        if (Supplier::query()->find($supplierId) === null) {
            throw new SupplierNotFoundException($supplierId);
        }

        $components = $this->computeComponents($supplierId);
        $score = $this->computeWeightedScore($components);
        $tier = $this->tier($score);

        return [
            'supplier_id' => $supplierId,
            'score' => round($score, 1),
            'tier' => $tier,
            'color' => $this->tierColor($tier),
            'trend' => 'stable',
            'components' => $components,
            'weights' => self::WEIGHTS,
        ];
    }

    /** @return array<string, float> */
    private function computeComponents(string $supplierId): array
    {
        return [
            'delivery_performance' => $this->deliveryPerformance($supplierId),
            'fill_rate' => $this->fillRate($supplierId),
            'price_stability' => $this->priceStability($supplierId),
            'activity' => $this->activity($supplierId),
            'financial_standing' => $this->financialStanding($supplierId),
            'inventory_impact' => $this->inventoryImpact($supplierId),
        ];
    }

    private function deliveryPerformance(string $supplierId): float
    {
        $row = DB::table('purchase_orders as po')
            ->join('goods_receipts as gr', 'gr.purchase_order_id', '=', 'po.id')
            ->where('po.supplier_id', $supplierId)
            ->where('gr.status', GoodsReceiptStatus::Posted->value)
            ->whereNotNull('po.expected_date')
            ->whereNull('po.deleted_at')
            ->whereNull('gr.deleted_at')
            ->selectRaw('
                COUNT(*) as total,
                SUM(CASE WHEN gr.receipt_date <= po.expected_date THEN 1 ELSE 0 END) as on_time
            ')
            ->first();

        if ($row === null || (int) $row->total === 0) {
            return 50.0;
        }

        return min(100.0, round((float) $row->on_time / (float) $row->total * 100, 1));
    }

    private function fillRate(string $supplierId): float
    {
        $row = DB::table('goods_receipt_lines as grl')
            ->join('goods_receipts as gr', 'grl.goods_receipt_id', '=', 'gr.id')
            ->join('purchase_orders as po', 'gr.purchase_order_id', '=', 'po.id')
            ->where('po.supplier_id', $supplierId)
            ->where('gr.status', GoodsReceiptStatus::Posted->value)
            ->whereNull('gr.deleted_at')
            ->selectRaw('
                COALESCE(SUM(COALESCE(grl.net_received_quantity, grl.received_quantity)::float), 0) as total_received,
                COALESCE(SUM(grl.ordered_quantity::float), 0) as total_ordered
            ')
            ->first();

        if ($row === null || (float) $row->total_ordered <= 0) {
            return 50.0;
        }

        return min(100.0, round((float) $row->total_received / (float) $row->total_ordered * 100, 1));
    }

    private function priceStability(string $supplierId): float
    {
        $rows = DB::table('goods_receipt_lines as grl')
            ->join('goods_receipts as gr', 'grl.goods_receipt_id', '=', 'gr.id')
            ->join('purchase_orders as po', 'gr.purchase_order_id', '=', 'po.id')
            ->where('po.supplier_id', $supplierId)
            ->where('gr.status', GoodsReceiptStatus::Posted->value)
            ->whereNull('gr.deleted_at')
            ->selectRaw('
                grl.product_id,
                STDDEV_SAMP(grl.unit_price::float) as price_stddev,
                AVG(grl.unit_price::float)          as price_avg,
                COUNT(*)                            as cnt
            ')
            ->groupBy('grl.product_id')
            ->having(DB::raw('COUNT(*)'), '>', 1)
            ->get();

        if ($rows->isEmpty()) {
            return 75.0;
        }

        $cvSum = $rows->sum(function ($r): float {
            if ((float) $r->price_avg <= 0) {
                return 0.0;
            }

            return (float) ($r->price_stddev ?? 0) / (float) $r->price_avg;
        });

        $avgCv = $cvSum / $rows->count();

        return min(100.0, max(0.0, round(100.0 - ($avgCv * 200), 1)));
    }

    private function activity(string $supplierId): float
    {
        $lastDate = DB::table('goods_receipts as gr')
            ->join('purchase_orders as po', 'gr.purchase_order_id', '=', 'po.id')
            ->where('po.supplier_id', $supplierId)
            ->where('gr.status', GoodsReceiptStatus::Posted->value)
            ->whereNull('gr.deleted_at')
            ->max('gr.receipt_date');

        if ($lastDate === null) {
            return 30.0;
        }

        $days = (int) now()->diffInDays($lastDate);

        return match (true) {
            $days <= 30 => 100.0,
            $days <= 60 => 85.0,
            $days <= 90 => 70.0,
            $days <= 180 => 40.0,
            default => 10.0,
        };
    }

    private function financialStanding(string $supplierId): float
    {
        $row = DB::table('goods_receipts as gr')
            ->join('purchase_orders as po', 'gr.purchase_order_id', '=', 'po.id')
            ->where('po.supplier_id', $supplierId)
            ->where('gr.status', GoodsReceiptStatus::Posted->value)
            ->whereNull('gr.deleted_at')
            ->selectRaw('
                COALESCE(SUM(gr.invoice_total_amount), 0) as total_invoiced,
                COALESCE(SUM(gr.paid_amount), 0)          as total_paid
            ')
            ->first();

        if ($row === null || (float) $row->total_invoiced <= 0) {
            return 100.0;
        }

        $outstanding = max(0.0, (float) $row->total_invoiced - (float) $row->total_paid);
        $ratio = $outstanding / (float) $row->total_invoiced;

        return min(100.0, max(0.0, round(100.0 - ($ratio * 100), 1)));
    }

    private function inventoryImpact(string $supplierId): float
    {
        $hasStock = DB::table('inventory_receipt_layers')
            ->where('supplier_id', $supplierId)
            ->where('remaining_qty', '>', 0)
            ->exists();

        return $hasStock ? 80.0 : 50.0;
    }

    /** @param array<string, float> $components */
    private function computeWeightedScore(array $components): float
    {
        $score = 0.0;
        foreach (self::WEIGHTS as $key => $weight) {
            $score += ($components[$key] ?? 50.0) * $weight;
        }

        return $score;
    }

    private function tier(float $score): string
    {
        return match (true) {
            $score >= 80 => 'excellent',
            $score >= 65 => 'good',
            $score >= 50 => 'watch',
            $score >= 30 => 'risk',
            default => 'critical',
        };
    }

    private function tierColor(string $tier): string
    {
        return match ($tier) {
            'excellent' => 'emerald',
            'good' => 'blue',
            'watch' => 'amber',
            'risk' => 'orange',
            'critical' => 'red',
            default => 'gray',
        };
    }
}
