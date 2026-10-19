<?php

declare(strict_types=1);

namespace Modules\Core\DemandAnalysis\Application\DTO;

/**
 * Comprehensive demand-analysis aggregate for a single product.
 * Single source of truth consumed by: Procurement, Inventory,
 * Dashboard, Preparation OS, and future AI Platform.
 */
final class DemandAnalysisDTO
{
    public function __construct(
        public readonly string $product_id,

        /** on_hand, reserved, available, incoming, in_transfer, damaged, expired, near_expiry, quarantine */
        public readonly array $inventory_health,

        /** daily_avg, weekly_avg, monthly_avg, rolling_90d_avg, trend, volatility, peak_consumption */
        public readonly array $demand_intelligence,

        /** current_coverage_days, risk, stockout_date, safety_stock, min_stock, max_stock, reorder_point, suggested_purchase_date */
        public readonly array $coverage_intelligence,

        /** preferred_supplier, last_supplier, alternative_suppliers, last_cost, avg_cost, lowest_cost, highest_cost,
         *  lead_time_days, moq, last_purchase_date, purchase_frequency, price_trend */
        public readonly array $procurement_intelligence,

        /** warehouses_carrying, total_inventory_value, selling_channels, companies_count,
         *  open_orders, reserved_qty, backordered_qty, sales_last_7d, sales_last_30d, revenue_last_30d */
        public readonly array $business_impact,

        /** list<{type, severity, message, recommended_qty}> — rule-engine output */
        public readonly array $recommendations,

        /** list<{type, date, description, quantity, supplier, value}> — audit events */
        public readonly array $timeline,
    ) {}

    public function toArray(): array
    {
        return [
            'product_id' => $this->product_id,
            'inventory_health' => $this->inventory_health,
            'demand_intelligence' => $this->demand_intelligence,
            'coverage_intelligence' => $this->coverage_intelligence,
            'procurement_intelligence' => $this->procurement_intelligence,
            'business_impact' => $this->business_impact,
            'recommendations' => $this->recommendations,
            'timeline' => $this->timeline,
        ];
    }

    /**
     * Backwards-compatible shape for the existing procurement panel endpoint.
     */
    public function toProcurementPanel(): array
    {
        $inv = $this->inventory_health;
        $dem = $this->demand_intelligence;
        $cov = $this->coverage_intelligence;
        $proc = $this->procurement_intelligence;

        return [
            'product_id' => $this->product_id,
            'inventory' => [
                'on_hand_qty' => $inv['on_hand'],
                'reserved_qty' => $inv['reserved'],
                'available_qty' => $inv['available'],
            ],
            'consumption' => [
                'daily_avg' => $dem['daily_avg'],
                'weekly_avg' => $dem['weekly_avg'],
                'monthly_avg' => $dem['monthly_avg'],
                'trend' => $dem['trend'],
            ],
            'coverage' => [
                'days_remaining' => $cov['current_coverage_days'],
                'risk' => $cov['risk'],
            ],
            'last_purchase' => $proc['last_purchase'],
            'alternative_suppliers' => $proc['alternative_suppliers'],
            'recommendations' => $this->recommendations,
        ];
    }
}
