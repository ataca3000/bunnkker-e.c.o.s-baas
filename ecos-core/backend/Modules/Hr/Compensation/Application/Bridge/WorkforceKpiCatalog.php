<?php

declare(strict_types=1);

namespace Modules\Hr\Compensation\Application\Bridge;

use Illuminate\Support\Carbon;
use Modules\Hr\Compensation\Domain\Enums\KpiMetric;
use Modules\Hr\Compensation\Domain\ValueObjects\WorkforceKpiEvent;

/**
 * The anti-corruption catalog: it translates a concrete operational domain event
 * into the normalized workforce fact HR understands.
 *
 * ┌─ WHY A CATALOG, NOT DIRECT COUPLING ────────────────────────────────────┐
 * │ Operational event names and payload shapes are theirs, not ours, and they  │
 * │ differ per module. Mapping HERE — by event-name string and a defensive     │
 * │ payload read — means HR couples to NO operational class and a module can    │
 * │ change its internals without breaking payroll.                            │
 * │                                                                            │
 * │ An event with no employee attached is NOT translated: a KPI with nobody to │
 * │ credit is not a workforce fact, and guessing an owner would put money in   │
 * │ the wrong person's payslip.                                                │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class WorkforceKpiCatalog
{
    /** @return array<int, string> the operational events this catalog can translate */
    public function knownEventNames(): array
    {
        return array_keys($this->map());
    }

    public function supports(string $eventName): bool
    {
        return isset($this->map()[$eventName]);
    }

    /**
     * Translate, or return null when the event is unmapped, has no company, or
     * carries nobody to credit.
     *
     * @param  array<string, mixed>  $payload  the operational event's toArray()
     */
    public function translate(string $eventName, string $eventId, array $payload): ?WorkforceKpiEvent
    {
        $spec = $this->map()[$eventName] ?? null;

        if ($spec === null) {
            return null;
        }

        $companyId = $this->str($payload, ['company_id', 'companyId']);
        $employeeId = $this->str($payload, [
            'employee_id', 'employeeId', 'assignee_employee_id', 'driver_employee_id',
            'salesperson_employee_id', 'operator_employee_id', 'picker_employee_id',
        ]);

        if ($companyId === null || $employeeId === null) {
            return null;
        }

        [$metric, $valueKeys, $quantityKeys] = $spec;

        return new WorkforceKpiEvent(
            companyId: $companyId,
            metric: $metric,
            employeeId: $employeeId,
            value: $this->num($payload, $valueKeys),
            quantity: $this->num($payload, $quantityKeys, default: 1.0),
            occurredAt: $this->when($payload),
            idempotencyKey: $metric->value.':'.$eventId,
            departmentId: $this->str($payload, ['department_id', 'departmentId']),
            sourceReference: $this->str($payload, ['id', 'order_id', 'shipment_id', 'ticket_id', 'reference']),
            metadata: ['event_name' => $eventName],
        );
    }

    /**
     * The mapping table: operational event name → [metric, value keys, quantity keys].
     *
     * Adding a source is a line here — no HR code changes, and still no import.
     *
     * @return array<string, array{0: KpiMetric, 1: array<int, string>, 2: array<int, string>}>
     */
    private function map(): array
    {
        return [
            // Commerce OS — sales credited to the representative who took the order.
            'commerce.order.completed' => [KpiMetric::SalesAmount, ['net_total', 'grand_total', 'total', 'amount'], []],
            'commerce.order.placed' => [KpiMetric::OrdersCount, [], ['count']],

            // Shipping OS — the driver who delivered it.
            'shipping.shipment.delivered' => [KpiMetric::DeliveredShipments, ['cod_amount', 'amount'], ['count']],
            'shipping.shipment.failed' => [KpiMetric::FailedDeliveries, [], ['count']],

            // Inventory OS — counted discrepancies attributed to the responsible operative.
            'inventory.count.completed' => [KpiMetric::InventoryAccuracy, ['accuracy_percent', 'accuracy'], []],
            'inventory.shortage.recorded' => [KpiMetric::InventoryShortage, ['amount', 'value'], ['quantity']],
            'inventory.damage.recorded' => [KpiMetric::InventoryDamage, ['amount', 'value'], ['quantity']],

            // CRM OS — the agent who closed the case.
            'crm.ticket.closed' => [KpiMetric::TicketsClosed, [], ['count']],

            // Preparation and Packing OS.
            'preparation.order.prepared' => [KpiMetric::OrdersPrepared, [], ['count']],
            'packing.order.packed' => [KpiMetric::OrdersPacked, [], ['count']],
        ];
    }

    /** @param array<int, string> $keys */
    private function str(array $payload, array $keys): ?string
    {
        foreach ($keys as $key) {
            $value = $payload[$key] ?? null;
            if ($value !== null && $value !== '') {
                return (string) $value;
            }
        }

        return null;
    }

    /** @param array<int, string> $keys */
    private function num(array $payload, array $keys, float $default = 0.0): float
    {
        foreach ($keys as $key) {
            $value = $payload[$key] ?? null;
            if (is_numeric($value)) {
                return round((float) $value, 4);
            }
        }

        return $default;
    }

    private function when(array $payload): Carbon
    {
        foreach (['occurred_at', 'occurredAt', 'delivered_at', 'completed_at', 'closed_at'] as $key) {
            $value = $payload[$key] ?? null;
            if (is_string($value) && $value !== '') {
                return Carbon::parse($value);
            }
        }

        return Carbon::now();
    }
}
