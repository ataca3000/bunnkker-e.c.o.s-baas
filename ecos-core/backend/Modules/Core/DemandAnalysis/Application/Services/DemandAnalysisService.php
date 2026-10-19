<?php

declare(strict_types=1);

namespace Modules\Core\DemandAnalysis\Application\Services;

use Illuminate\Support\Facades\DB;
use Modules\Core\DemandAnalysis\Application\DTO\DemandAnalysisDTO;
use Modules\Inventory\InventoryItems\Domain\Models\InventoryItem;
use Modules\Inventory\StockLedger\Domain\Models\StockMovement;

/**
 * Unified demand-analysis engine for a single product.
 *
 * Single source of truth consumed by:
 *   - Procurement (purchase materials panel)
 *   - Inventory (product drawer)
 *   - Dashboard (KPIs)
 *   - Preparation OS (batch builder)
 *   - Future AI Platform (forecasting hooks)
 *
 * No duplicated calculations anywhere else.
 */
final class DemandAnalysisService
{
    private const OUTBOUND_TYPES = ['sales_issue', 'adjustment_out', 'transfer_out'];

    public function analyze(string $productId, ?string $warehouseId = null): DemandAnalysisDTO
    {
        $inventoryHealth = $this->inventoryHealth($productId, $warehouseId);
        $demandIntelligence = $this->demandIntelligence($productId, $warehouseId);
        $coverageIntelligence = $this->coverageIntelligence($inventoryHealth, $demandIntelligence);
        $procurementIntelligence = $this->procurementIntelligence($productId);
        $businessImpact = $this->businessImpact($productId, $inventoryHealth, $demandIntelligence);
        $recommendations = $this->recommendations($inventoryHealth, $demandIntelligence, $coverageIntelligence, $procurementIntelligence);
        $timeline = $this->timeline($productId, $warehouseId);

        return new DemandAnalysisDTO(
            product_id: $productId,
            inventory_health: $inventoryHealth,
            demand_intelligence: $demandIntelligence,
            coverage_intelligence: $coverageIntelligence,
            procurement_intelligence: $procurementIntelligence,
            business_impact: $businessImpact,
            recommendations: $recommendations,
            timeline: $timeline,
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 1. Inventory Health
    // ─────────────────────────────────────────────────────────────────────────

    private function inventoryHealth(string $productId, ?string $warehouseId): array
    {
        $q = InventoryItem::where('product_id', $productId);
        if ($warehouseId) {
            $q->where('warehouse_id', $warehouseId);
        }

        $row = $q->select(
            DB::raw('COALESCE(SUM(on_hand_qty), 0) as on_hand'),
            DB::raw('COALESCE(SUM(reserved_qty), 0) as reserved'),
        )->first();

        $onHand = (float) ($row?->on_hand ?? 0);
        $reserved = (float) ($row?->reserved ?? 0);
        $available = max(0.0, $onHand - $reserved);

        // Incoming: approved/purchasing purchase material lines for this product
        $incoming = $this->incomingQty($productId, $warehouseId);

        return [
            'on_hand' => round($onHand, 4),
            'reserved' => round($reserved, 4),
            'available' => round($available, 4),
            'incoming' => round($incoming, 4),
            'in_transfer' => 0.0,   // reserved for future transfer tracking
            'damaged' => null,  // requires dedicated stock status field
            'expired' => null,  // requires expiry date tracking
            'near_expiry' => null,  // requires expiry date tracking
            'quarantine' => null,  // requires quarantine status tracking
        ];
    }

    private function incomingQty(string $productId, ?string $warehouseId): float
    {
        $q = DB::table('purchase_material_lines as pml')
            ->join('purchase_materials as pm', 'pm.id', '=', 'pml.purchase_material_id')
            ->where('pml.product_id', $productId)
            ->whereIn('pm.status', ['approved', 'purchasing', 'receiving']);

        if ($warehouseId) {
            $q->where('pm.warehouse_id', $warehouseId);
        }

        return (float) $q->sum('pml.requested_qty');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Demand Intelligence
    // ─────────────────────────────────────────────────────────────────────────

    private function demandIntelligence(string $productId, ?string $warehouseId): array
    {
        $base = StockMovement::where('product_id', $productId)
            ->whereIn('movement_type', self::OUTBOUND_TYPES);
        if ($warehouseId) {
            $base->where('warehouse_id', $warehouseId);
        }

        $sum30 = (float) (clone $base)->where('movement_date', '>=', now()->subDays(30))->sum(DB::raw('ABS(quantity)'));
        $sum7 = (float) (clone $base)->where('movement_date', '>=', now()->subDays(7))->sum(DB::raw('ABS(quantity)'));
        $sum90 = (float) (clone $base)->where('movement_date', '>=', now()->subDays(90))->sum(DB::raw('ABS(quantity)'));

        $dailyAvg = $sum30 / 30;
        $weeklyAvg = $dailyAvg * 7;
        $monthlyAvg = $dailyAvg * 30;
        $rolling90 = $sum90 / 90;

        // Trend: compare last 7-day daily rate vs last 30-day daily rate
        $last7Avg = $sum7 / 7;
        $trend = 'normal';
        if ($dailyAvg > 0) {
            if ($last7Avg > $dailyAvg * 1.15) {
                $trend = 'higher';
            } elseif ($last7Avg < $dailyAvg * 0.85) {
                $trend = 'lower';
            }
        }

        // Volatility: standard deviation of daily consumption over last 30 days
        $volatility = $this->demandVolatility($productId, $warehouseId);

        // Peak: max single-day outbound in last 30 days
        $peakRow = (clone $base)
            ->where('movement_date', '>=', now()->subDays(30))
            ->select(DB::raw('MAX(ABS(quantity)) as peak'))
            ->first();
        $peak = (float) ($peakRow?->peak ?? 0);

        return [
            'daily_avg' => round($dailyAvg, 4),
            'weekly_avg' => round($weeklyAvg, 4),
            'monthly_avg' => round($monthlyAvg, 4),
            'rolling_90d_avg' => round($rolling90, 4),
            'trend' => $trend,
            'volatility' => $volatility !== null ? round($volatility, 4) : null,
            'peak_consumption' => round($peak, 4),
            'seasonality' => null, // future extension point
        ];
    }

    private function demandVolatility(string $productId, ?string $warehouseId): ?float
    {
        // Daily outbound quantities over last 30 days
        $rows = DB::table('stock_movements')
            ->where('product_id', $productId)
            ->whereIn('movement_type', self::OUTBOUND_TYPES)
            ->where('movement_date', '>=', now()->subDays(30))
            ->when($warehouseId, fn ($q) => $q->where('warehouse_id', $warehouseId))
            ->select(
                'movement_date',
                DB::raw('SUM(ABS(quantity)) as daily_qty'),
            )
            ->groupBy('movement_date')
            ->get();

        if ($rows->count() < 2) {
            return null;
        }

        $values = $rows->pluck('daily_qty')->map(fn ($v) => (float) $v)->toArray();
        $mean = array_sum($values) / count($values);
        $variance = array_sum(array_map(fn ($v) => ($v - $mean) ** 2, $values)) / count($values);

        return sqrt($variance);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Coverage Intelligence
    // ─────────────────────────────────────────────────────────────────────────

    private function coverageIntelligence(array $inventory, array $demand): array
    {
        $available = $inventory['available'];
        $daily = $demand['daily_avg'];

        $daysRemaining = null;
        $stockoutDate = null;
        $risk = 'unknown';

        if ($daily > 0) {
            $daysRemaining = $available / $daily;
            $stockoutDate = now()->addDays((int) $daysRemaining)->toDateString();

            $risk = match (true) {
                $daysRemaining <= 0 => 'critical',
                $daysRemaining <= 3 => 'critical',
                $daysRemaining <= 7 => 'high',
                $daysRemaining <= 14 => 'medium',
                default => 'low',
            };
        }

        // Suggested purchase date = today (if critical/high) or stockout_date - 14 days lead buffer
        $suggestedPurchaseDate = null;
        if ($daysRemaining !== null) {
            $bufferDays = 14; // default lead time assumption
            $daysUntilReorder = max(0, $daysRemaining - $bufferDays);
            $suggestedPurchaseDate = now()->addDays((int) $daysUntilReorder)->toDateString();
        }

        return [
            'current_coverage_days' => $daysRemaining !== null ? round($daysRemaining, 1) : null,
            'risk' => $risk,
            'stockout_date' => $stockoutDate,
            'suggested_purchase_date' => $suggestedPurchaseDate,
            // Requires separate stock-level config table — returning null until implemented
            'safety_stock' => null,
            'min_stock' => null,
            'max_stock' => null,
            'reorder_point' => null,
            'coverage_trend' => $demand['trend'],
        ];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Procurement Intelligence
    // ─────────────────────────────────────────────────────────────────────────

    private function procurementIntelligence(string $productId): array
    {
        $lastPurchase = $this->lastPurchaseData($productId);
        $altSuppliers = $this->alternativeSuppliers($productId);
        $costStats = $this->costStats($productId);
        $purchaseFreq = $this->purchaseFrequency($productId);
        $priceTrend = $this->priceTrend($productId);

        $preferredSupplier = count($altSuppliers) > 0 ? $altSuppliers[0] : null;

        return [
            'preferred_supplier' => $preferredSupplier,
            'last_purchase' => $lastPurchase,
            'alternative_suppliers' => $altSuppliers,
            'last_cost' => $lastPurchase['last_price'] ?? null,
            'avg_cost' => $costStats['avg'],
            'lowest_cost' => $costStats['min'],
            'highest_cost' => $costStats['max'],
            'lead_time_days' => null, // requires supplier lead-time table
            'moq' => null, // requires supplier MOQ table
            'last_purchase_date' => $lastPurchase['purchase_date'] ?? null,
            'purchase_frequency' => $purchaseFreq,
            'price_trend' => $priceTrend,
        ];
    }

    private function lastPurchaseData(string $productId): ?array
    {
        $row = DB::table('goods_receipt_lines as grl')
            ->join('goods_receipts as gr', 'gr.id', '=', 'grl.goods_receipt_id')
            ->join('purchase_orders as po', 'po.id', '=', 'gr.purchase_order_id')
            ->join('suppliers as s', 's.id', '=', 'po.supplier_id')
            ->where('grl.product_id', $productId)
            ->whereNotNull('gr.receipt_date')
            ->select('s.id as supplier_id', 's.name as supplier_name', 'grl.unit_price as last_price', 'gr.receipt_date as purchase_date')
            ->orderByDesc('gr.receipt_date')
            ->first();

        if (! $row) {
            return null;
        }

        return [
            'supplier_id' => $row->supplier_id,
            'supplier_name' => $row->supplier_name,
            'last_price' => (float) $row->last_price,
            'purchase_date' => $row->purchase_date,
        ];
    }

    private function alternativeSuppliers(string $productId): array
    {
        $rows = DB::table('goods_receipt_lines as grl')
            ->join('goods_receipts as gr', 'gr.id', '=', 'grl.goods_receipt_id')
            ->join('purchase_orders as po', 'po.id', '=', 'gr.purchase_order_id')
            ->join('suppliers as s', 's.id', '=', 'po.supplier_id')
            ->where('grl.product_id', $productId)
            ->where('gr.receipt_date', '>=', now()->subDays(365)->toDateString())
            ->whereNotNull('po.supplier_id')
            ->select(
                's.id as supplier_id',
                's.name as supplier_name',
                DB::raw('MAX(gr.receipt_date) as last_delivery_date'),
                DB::raw('(SELECT grl2.unit_price FROM goods_receipt_lines grl2
                          JOIN goods_receipts gr2 ON gr2.id = grl2.goods_receipt_id
                          JOIN purchase_orders po2 ON po2.id = gr2.purchase_order_id
                          WHERE grl2.product_id = grl.product_id AND po2.supplier_id = s.id
                          ORDER BY gr2.receipt_date DESC LIMIT 1) as last_price'),
            )
            ->groupBy('s.id', 's.name', 'grl.product_id')
            ->orderByDesc('last_delivery_date')
            ->limit(5)
            ->get();

        return $rows->map(fn ($r) => [
            'supplier_id' => $r->supplier_id,
            'supplier_name' => $r->supplier_name,
            'last_price' => $r->last_price !== null ? (float) $r->last_price : null,
            'last_delivery_date' => $r->last_delivery_date,
            'lead_time_days' => null,
            'moq' => null,
        ])->values()->toArray();
    }

    private function costStats(string $productId): array
    {
        $row = DB::table('goods_receipt_lines as grl')
            ->join('goods_receipts as gr', 'gr.id', '=', 'grl.goods_receipt_id')
            ->where('grl.product_id', $productId)
            ->where('grl.unit_price', '>', 0)
            ->select(
                DB::raw('AVG(grl.unit_price) as avg_price'),
                DB::raw('MIN(grl.unit_price) as min_price'),
                DB::raw('MAX(grl.unit_price) as max_price'),
            )
            ->first();

        return [
            'avg' => $row?->avg_price !== null ? round((float) $row->avg_price, 4) : null,
            'min' => $row?->min_price !== null ? round((float) $row->min_price, 4) : null,
            'max' => $row?->max_price !== null ? round((float) $row->max_price, 4) : null,
        ];
    }

    private function purchaseFrequency(string $productId): ?float
    {
        // Receipts in last 180 days → per-month rate
        $count = DB::table('goods_receipt_lines as grl')
            ->join('goods_receipts as gr', 'gr.id', '=', 'grl.goods_receipt_id')
            ->where('grl.product_id', $productId)
            ->where('gr.receipt_date', '>=', now()->subDays(180)->toDateString())
            ->count();

        return $count > 0 ? round($count / 6.0, 2) : null; // per month
    }

    private function priceTrend(string $productId): ?string
    {
        $rows = DB::table('goods_receipt_lines as grl')
            ->join('goods_receipts as gr', 'gr.id', '=', 'grl.goods_receipt_id')
            ->where('grl.product_id', $productId)
            ->where('grl.unit_price', '>', 0)
            ->select('grl.unit_price')
            ->orderByDesc('gr.receipt_date')
            ->limit(3)
            ->pluck('unit_price')
            ->map(fn ($v) => (float) $v)
            ->toArray();

        if (count($rows) < 2) {
            return null;
        }

        // Rising if latest > earliest by >5%, falling if <5% lower
        $latest = $rows[0];
        $earliest = $rows[count($rows) - 1];

        if ($earliest <= 0) {
            return null;
        }

        $change = ($latest - $earliest) / $earliest;

        return match (true) {
            $change > 0.05 => 'rising',
            $change < -0.05 => 'falling',
            default => 'stable',
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. Business Impact
    // ─────────────────────────────────────────────────────────────────────────

    private function businessImpact(string $productId, array $inventory, array $demand): array
    {
        // Warehouses carrying this product (on_hand > 0)
        $warehousesCarrying = InventoryItem::where('product_id', $productId)
            ->where('on_hand_qty', '>', 0)
            ->count();

        // Total inventory value: on_hand * average_cost from product table
        $product = DB::table('products')->where('id', $productId)
            ->select('average_cost')
            ->first();
        $avgCost = (float) ($product?->average_cost ?? 0);
        $totalValue = round($inventory['on_hand'] * $avgCost, 2);

        // Sales from StockMovement (sales_issue)
        $sales7d = (float) StockMovement::where('product_id', $productId)
            ->where('movement_type', 'sales_issue')
            ->where('movement_date', '>=', now()->subDays(7))
            ->sum(DB::raw('ABS(quantity)'));

        $sales30d = (float) StockMovement::where('product_id', $productId)
            ->where('movement_type', 'sales_issue')
            ->where('movement_date', '>=', now()->subDays(30))
            ->sum(DB::raw('ABS(quantity)'));

        $revenue30d = $avgCost > 0 ? round($sales30d * $avgCost, 2) : null;

        // Estimated stockout date (alias for coverage)
        $stockoutDate = null;
        if ($demand['daily_avg'] > 0 && $inventory['available'] > 0) {
            $stockoutDate = now()->addDays((int) ($inventory['available'] / $demand['daily_avg']))->toDateString();
        }

        return [
            'warehouses_carrying' => $warehousesCarrying,
            'total_inventory_value' => $totalValue,
            'selling_channels' => null, // requires channel product assignment table
            'companies_count' => null, // requires company product assignment table
            'open_orders' => null, // requires order_lines join — populated when available
            'reserved_qty' => $inventory['reserved'],
            'backordered_qty' => null, // requires backorder tracking
            'pending_preparation' => null, // future Preparation OS
            'sales_last_7d' => round($sales7d, 4),
            'sales_last_30d' => round($sales30d, 4),
            'revenue_last_30d' => $revenue30d,
            'estimated_stockout_date' => $stockoutDate,
        ];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6. Recommendations (rule engine)
    // ─────────────────────────────────────────────────────────────────────────

    private function recommendations(array $inventory, array $demand, array $coverage, array $procurement): array
    {
        $recs = [];

        $available = $inventory['available'];
        $daily = $demand['daily_avg'];
        $days = $coverage['current_coverage_days'];
        $risk = $coverage['risk'];
        $lastCost = $procurement['last_cost'];
        $altSuppliers = $procurement['alternative_suppliers'];

        // ── Healthy stock ────────────────────────────────────────────────────
        if ($days !== null && $days > 30 && $daily > 0) {
            $recs[] = $this->rec('coverage_healthy', 'info', '🟢', "Inventory healthy — covers ~{$days} days.");
        }

        // ── Critical stock ───────────────────────────────────────────────────
        if ($risk === 'critical') {
            $recs[] = $this->rec('critical_stock', 'error', '🔴', sprintf(
                'Product may stock out in %.1f day(s). Purchase urgently.',
                $days ?? 0,
            ));
        }

        // ── High risk ────────────────────────────────────────────────────────
        if ($risk === 'high') {
            $recs[] = $this->rec('low_coverage', 'warning', '🟡', sprintf(
                'Coverage is below target (%.1f days). Consider placing a purchase request.',
                $days ?? 0,
            ));
        }

        // ── No consumption data ──────────────────────────────────────────────
        if ($daily <= 0 && $available > 0) {
            $recs[] = $this->rec('no_demand_data', 'info', '🔵', 'No recent consumption recorded. Verify if this product is still active.');
        }

        // ── Overstock ────────────────────────────────────────────────────────
        if ($days !== null && $days > 90 && $daily > 0) {
            $recs[] = $this->rec('overstock_risk', 'warning', '🟠', sprintf(
                'Overstock risk — current coverage is %.0f days. Hold purchasing.',
                $days,
            ));
        }

        // ── Price increase ───────────────────────────────────────────────────
        if ($procurement['price_trend'] === 'rising') {
            $recs[] = $this->rec('price_rising', 'warning', '🟡', 'Supplier recently increased prices. Consider negotiating or switching supplier.');
        }

        // ── Better supplier ──────────────────────────────────────────────────
        if ($lastCost !== null && $lastCost > 0) {
            foreach ($altSuppliers as $s) {
                $altPrice = $s['last_price'] ?? null;
                if ($altPrice !== null && $altPrice < $lastCost * 0.95) {
                    $recs[] = $this->rec('better_supplier', 'info', '🟠', sprintf(
                        '%s offers a lower price (%.2f vs %.2f) — ~%.1f%% saving.',
                        $s['supplier_name'],
                        $altPrice,
                        $lastCost,
                        (1 - $altPrice / $lastCost) * 100,
                    ));
                    break;
                }
            }
        }

        // ── Incoming covers need ─────────────────────────────────────────────
        if ($inventory['incoming'] > 0 && $risk !== 'low') {
            $recs[] = $this->rec('incoming_stock', 'info', '🔵', sprintf(
                '%.0f units incoming (approved/purchasing). This may cover the shortage.',
                $inventory['incoming'],
            ));
        }

        return $recs;
    }

    /** @return array{type: string, severity: string, message: string, recommended_qty: null} */
    private function rec(string $type, string $severity, string $emoji, string $message): array
    {
        return [
            'type' => $type,
            'severity' => $severity,
            'message' => $message,
            'recommended_qty' => null,
        ];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 7. Timeline
    // ─────────────────────────────────────────────────────────────────────────

    private function timeline(string $productId, ?string $warehouseId): array
    {
        $events = [];

        // Last 8 stock movements
        $movements = StockMovement::where('product_id', $productId)
            ->when($warehouseId, fn ($q) => $q->where('warehouse_id', $warehouseId))
            ->orderByDesc('movement_date')
            ->orderByDesc('created_at')
            ->limit(8)
            ->get(['movement_type', 'quantity', 'movement_date', 'notes']);

        foreach ($movements as $m) {
            $events[] = [
                'type' => 'inventory_event',
                'subtype' => $m->movement_type,
                'date' => $m->movement_date,
                'description' => ucfirst(str_replace('_', ' ', $m->movement_type)),
                'quantity' => (float) $m->quantity,
                'supplier' => null,
                'value' => null,
            ];
        }

        // Last 5 goods receipt events
        $receipts = DB::table('goods_receipt_lines as grl')
            ->join('goods_receipts as gr', 'gr.id', '=', 'grl.goods_receipt_id')
            ->join('purchase_orders as po', 'po.id', '=', 'gr.purchase_order_id')
            ->join('suppliers as s', 's.id', '=', 'po.supplier_id')
            ->where('grl.product_id', $productId)
            ->whereNotNull('gr.receipt_date')
            ->select(
                's.name as supplier_name',
                'grl.received_qty as quantity',
                'grl.unit_price as price',
                'gr.receipt_date as date',
            )
            ->orderByDesc('gr.receipt_date')
            ->limit(5)
            ->get();

        foreach ($receipts as $r) {
            $qty = (float) ($r->quantity ?? 0);
            $price = (float) ($r->price ?? 0);
            $events[] = [
                'type' => 'purchase_event',
                'subtype' => 'goods_receipt',
                'date' => $r->date,
                'description' => 'Goods Receipt',
                'quantity' => $qty,
                'supplier' => $r->supplier_name,
                'value' => $qty * $price,
            ];
        }

        // Sort all events by date desc
        usort($events, fn ($a, $b) => strcmp((string) ($b['date'] ?? ''), (string) ($a['date'] ?? '')));

        return array_slice($events, 0, 15);
    }
}
