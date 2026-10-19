<?php

declare(strict_types=1);

namespace Modules\Hr\Compensation\Domain\Enums;

/**
 * The registry of operational metrics HR understands.
 *
 * ┌─ THE SHARED VOCABULARY BETWEEN HR AND THE BUSINESS ─────────────────────┐
 * │ Every metric key is a string an operational module can push a fact under, │
 * │ a commission rule can be written against, and a goal can target. Naming    │
 * │ them in one enum means all three speak the same language, and adding a new │
 * │ measure is a case here rather than a change in three places.               │
 * │                                                                            │
 * │ HR imports nothing from these modules — the key is the entire contract.    │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
enum KpiMetric: string
{
    // Commerce OS
    case SalesAmount = 'commerce.sales_amount';
    case OrdersCount = 'commerce.orders_count';

    // Shipping OS
    case DeliveredShipments = 'shipping.delivered_shipments';
    case FailedDeliveries = 'shipping.failed_deliveries';

    // Inventory OS
    case InventoryAccuracy = 'inventory.accuracy_percent';
    case InventoryShortage = 'inventory.shortage_amount';
    case InventoryDamage = 'inventory.damage_amount';

    // CRM OS
    case TicketsClosed = 'crm.tickets_closed';
    case CustomerSatisfaction = 'crm.satisfaction_percent';

    // Preparation OS
    case OrdersPrepared = 'preparation.orders_prepared';

    // Packing OS
    case OrdersPacked = 'packing.orders_packed';

    /** Which module owns the measurement. HR only ever reads the facts it pushes. */
    public function sourceModule(): string
    {
        return explode('.', $this->value)[0];
    }

    public function label(): string
    {
        return match ($this) {
            self::SalesAmount => 'Sales Amount',
            self::OrdersCount => 'Orders Count',
            self::DeliveredShipments => 'Delivered Shipments',
            self::FailedDeliveries => 'Failed Deliveries',
            self::InventoryAccuracy => 'Inventory Accuracy',
            self::InventoryShortage => 'Inventory Shortage',
            self::InventoryDamage => 'Inventory Damage',
            self::TicketsClosed => 'Tickets Closed',
            self::CustomerSatisfaction => 'Customer Satisfaction',
            self::OrdersPrepared => 'Orders Prepared',
            self::OrdersPacked => 'Orders Packed',
        };
    }

    /** How facts for this metric roll up over a period. */
    public function aggregation(): KpiAggregation
    {
        return match ($this) {
            // A percentage cannot be summed — it is averaged across the facts.
            self::InventoryAccuracy, self::CustomerSatisfaction => KpiAggregation::Average,
            default => KpiAggregation::Sum,
        };
    }

    /** Whether the metric is a money value or a countable quantity. */
    public function isMonetary(): bool
    {
        return in_array($this, [
            self::SalesAmount, self::InventoryShortage, self::InventoryDamage,
        ], true);
    }

    /** For most metrics more is better; shortages and failures are the exception. */
    public function higherIsBetter(): bool
    {
        return ! in_array($this, [
            self::FailedDeliveries, self::InventoryShortage, self::InventoryDamage,
        ], true);
    }

    public function unit(): string
    {
        return match (true) {
            $this->isMonetary() => 'currency',
            $this === self::InventoryAccuracy, $this === self::CustomerSatisfaction => 'percent',
            default => 'count',
        };
    }

    /** @return array<int, self> every metric a module publishes */
    public static function forModule(string $module): array
    {
        return array_values(array_filter(self::cases(), fn (self $m) => $m->sourceModule() === $module));
    }

    /** @return array<int, string> the modules that feed the KPI engine */
    public static function sourceModules(): array
    {
        return array_values(array_unique(array_map(fn (self $m) => $m->sourceModule(), self::cases())));
    }
}
