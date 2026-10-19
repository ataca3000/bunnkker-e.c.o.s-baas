<?php

declare(strict_types=1);

namespace Modules\Finance\Integration\Application\Bridge;

use Illuminate\Support\Carbon;
use Modules\Finance\Integration\Domain\Enums\BusinessEventType;
use Modules\Finance\Integration\Domain\ValueObjects\FinancialEvent;

/**
 * The anti-corruption catalog: it translates a concrete operational domain event
 * (identified by its dot-notation eventName and its flat payload) into the
 * normalized FinancialEvent Finance understands.
 *
 * ┌─ WHY A CATALOG, NOT DIRECT COUPLING ────────────────────────────────────┐
 * │ Operational event-name strings do NOT match Finance's business-event      │
 * │ codes (e.g. "inventory.stock.received" ≠ "inventory.goods_receipt"), the  │
 * │ modules use three different event styles, and some carry no monetary       │
 * │ value at all. Mapping HERE — by event-name string and a defensive payload  │
 * │ read — means Finance couples to NO operational class. An event we cannot   │
 * │ value (missing amount) returns null and the subscriber records it as       │
 * │ unpostable rather than guessing a number.                                  │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class EventPostingCatalog
{
    /** The operational event names this catalog knows how to translate. */
    public function knownEventNames(): array
    {
        return array_keys($this->map());
    }

    public function supports(string $eventName): bool
    {
        return isset($this->map()[$eventName]);
    }

    /**
     * Translate an operational event into a FinancialEvent, or null when it is
     * not mapped or cannot be valued from its payload.
     *
     * @param  array<string, mixed>  $payload  the operational event's toArray()
     */
    public function translate(string $eventName, string $eventId, array $payload): ?FinancialEvent
    {
        $spec = $this->map()[$eventName] ?? null;
        if ($spec === null) {
            return null;
        }

        return ($spec)($eventId, $payload);
    }

    /**
     * The mapping table: operational event name → a builder that reads the
     * payload defensively and returns a FinancialEvent (or null if unvaluable).
     *
     * @return array<string, callable(string, array<string,mixed>): ?FinancialEvent>
     */
    private function map(): array
    {
        return [
            // ── POS ─────────────────────────────────────────────────────────────
            'pos.sale.finalized' => function (string $id, array $p): ?FinancialEvent {
                $company = $this->str($p, ['companyId', 'company_id']);
                $gross = $this->num($p, ['grandTotal', 'grand_total']);
                if ($company === null || $gross === null) {
                    return null;
                }
                $discount = $this->num($p, ['discountTotal', 'discount_total']) ?? 0.0;
                $subtotal = $this->num($p, ['subtotal']) ?? $gross;
                $net = round($subtotal - $discount, 4);
                $tax = round($gross - $net, 4);

                return $this->event($company, BusinessEventType::PosSale, 'pos', 'pos_sale',
                    $this->str($p, ['saleId', 'sale_id']) ?? $id, $id, [
                        'net' => max($net, 0.0), 'tax' => max($tax, 0.0), 'gross' => $gross,
                    ], $p);
            },
            'pos.sale.refunded' => function (string $id, array $p): ?FinancialEvent {
                $company = $this->str($p, ['companyId', 'company_id']);
                $amount = $this->num($p, ['refundAmount', 'amount', 'totalAmount']);
                if ($company === null || $amount === null) {
                    return null;
                }

                return $this->event($company, BusinessEventType::PosRefund, 'pos', 'pos_sale',
                    $this->str($p, ['saleId', 'sale_id']) ?? $id, $id, ['gross' => $amount], $p);
            },

            // ── Inventory (valued only when the event carries a cost/value) ───────
            'inventory.stock.received' => function (string $id, array $p): ?FinancialEvent {
                $company = $this->str($p, ['companyId', 'company_id']);
                // extended_cost is the figure the event itself derived from the
                // quantity that actually moved (EPIC-FIN-INTEGRATION-003). The
                // older keys stay readable so a replayed historical event is not
                // silently revalued by this change.
                $value = $this->num($p, ['extended_cost', 'posting_amount', 'totalValue', 'total_value', 'value', 'cost']);
                if ($company === null || $value === null) {
                    return null; // quantity without a cost cannot be valued here
                }

                return $this->event($company, BusinessEventType::GoodsReceipt, 'inventory', 'inventory_item',
                    $this->str($p, ['inventoryItemId', 'inventory_item_id']) ?? $id, $id,
                    ['net' => $value], $p);
            },
            'inventory.stock.transferred' => function (string $id, array $p): ?FinancialEvent {
                $company = $this->str($p, ['companyId', 'company_id']);
                // A transfer already knew its total cost; it just had no entry here.
                $value = $this->num($p, ['extended_cost', 'posting_amount', 'total_cost', 'totalCost']);
                if ($company === null || $value === null) {
                    return null;
                }

                return $this->event($company, BusinessEventType::WarehouseTransfer, 'inventory', 'inventory_transfer',
                    $this->str($p, ['transferId', 'transfer_id']) ?? $id, $id,
                    ['net' => $value], $p);
            },
            'inventory.stock.adjusted' => function (string $id, array $p): ?FinancialEvent {
                $company = $this->str($p, ['companyId', 'company_id']);
                $value = $this->num($p, ['totalValue', 'total_value', 'value', 'cost']);
                if ($company === null || $value === null) {
                    return null;
                }
                $direction = strtolower((string) ($p['adjustmentType'] ?? $p['adjustment_type'] ?? 'out'));
                $type = $direction === 'in'
                    ? BusinessEventType::InventoryAdjustmentIncrease
                    : BusinessEventType::InventoryAdjustmentDecrease;

                return $this->event($company, $type, 'inventory', 'inventory_item',
                    $this->str($p, ['inventoryItemId', 'inventory_item_id']) ?? $id, $id,
                    ['net' => abs($value)], $p);
            },
        ];
    }

    /**
     * @param  array<string, float>  $amounts
     * @param  array<string, mixed>  $payload
     */
    private function event(
        string $companyId,
        BusinessEventType $type,
        string $module,
        string $entityType,
        string $entityId,
        string $eventId,
        array $amounts,
        array $payload,
    ): FinancialEvent {
        return new FinancialEvent(
            companyId: $companyId,
            eventType: $type,
            sourceModule: $module,
            entityType: $entityType,
            entityId: $entityId,
            amounts: $amounts,
            occurredAt: isset($payload['occurredAt']) ? Carbon::parse((string) $payload['occurredAt']) : Carbon::now(),
            idempotencyKey: $type->value.':'.$eventId,
            dimensions: [
                'branch_id' => $this->str($payload, ['branchId', 'branch_id', 'warehouseId', 'warehouse_id']),
                'cost_center_id' => $payload['costCenterId'] ?? $payload['cost_center_id'] ?? null,
                // Carried verbatim from the publisher. Finance uses it to pick an
                // account role and never interprets it further.
                'inventory_class' => $this->str($payload, ['inventory_class', 'inventoryClass']),
            ],
            currency: (string) ($payload['currency'] ?? 'EGP'),
            actorId: isset($payload['actorId']) ? (int) $payload['actorId'] : (isset($payload['userId']) ? (int) $payload['userId'] : null),
        );
    }

    /** @param array<string, mixed> $p @param list<string> $keys */
    private function num(array $p, array $keys): ?float
    {
        foreach ($keys as $key) {
            if (isset($p[$key]) && is_numeric($p[$key])) {
                return round((float) $p[$key], 4);
            }
        }

        return null;
    }

    /** @param array<string, mixed> $p @param list<string> $keys */
    private function str(array $p, array $keys): ?string
    {
        foreach ($keys as $key) {
            if (isset($p[$key]) && $p[$key] !== '') {
                return (string) $p[$key];
            }
        }

        return null;
    }
}
