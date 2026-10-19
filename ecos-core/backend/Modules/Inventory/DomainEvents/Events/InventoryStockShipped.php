<?php

declare(strict_types=1);

namespace Modules\Inventory\DomainEvents\Events;

use DateTimeImmutable;
use DateTimeInterface;
use DateTimeZone;
use Modules\Inventory\DomainEvents\Contracts\DomainEvent;
use Modules\Inventory\Products\Domain\Enums\InventoryClass;

/**
 * Raised after reserved stock is physically shipped out of a warehouse.
 *
 * Publisher : ShipStockAction (after DB transaction commits)
 * Trigger   : Fulfilment posting, shipment confirmation
 *
 * Both on_hand and reserved decrease by the shipped quantity.
 */
final class InventoryStockShipped implements DomainEvent
{
    private readonly string $eventId;

    private readonly DateTimeImmutable $occurredAt;

    public function __construct(
        public readonly string $inventoryItemId,
        public readonly string $warehouseId,
        public readonly string $productId,
        public readonly string $companyId,
        public readonly float $quantityShipped,
        public readonly float $onHandBefore,
        public readonly float $onHandAfter,
        public readonly float $reservedBefore,
        public readonly float $reservedAfter,
        public readonly InventoryClass $inventoryClass,
        /** What the shipped stock cost to acquire — discoverable, unlike an increase. */
        public readonly float $unitCost,
        public readonly ?string $referenceType = null,
        public readonly ?string $referenceId = null,
        public readonly string $currency = 'EGP',
        public readonly ?int $actorId = null,
    ) {
        $this->eventId = self::generateUuid();
        $this->occurredAt = new DateTimeImmutable('now', new DateTimeZone('UTC'));
    }

    public function eventId(): string
    {
        return $this->eventId;
    }

    /** The value of the stock that left, derived from the quantity that left. */
    public function extendedCost(): float
    {
        return round($this->quantityShipped * $this->unitCost, 4);
    }

    public function eventName(): string
    {
        return 'inventory.stock.shipped';
    }

    public function eventVersion(): int
    {
        return 1;
    }

    public function correlationId(): string
    {
        return $this->eventId;
    }

    public function occurredAt(): DateTimeImmutable
    {
        return $this->occurredAt;
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'event_id' => $this->eventId,
            'event_name' => $this->eventName(),
            'version' => $this->eventVersion(),
            'correlation_id' => $this->correlationId(),
            'occurred_at' => $this->occurredAt->format(DateTimeInterface::ATOM),
            'inventory_item_id' => $this->inventoryItemId,
            'warehouse_id' => $this->warehouseId,
            'product_id' => $this->productId,
            'company_id' => $this->companyId,
            'quantity_shipped' => $this->quantityShipped,
            'on_hand_before' => $this->onHandBefore,
            'on_hand_after' => $this->onHandAfter,
            'reserved_before' => $this->reservedBefore,
            'reserved_after' => $this->reservedAfter,
            'reference_type' => $this->referenceType,
            'reference_id' => $this->referenceId,

            // ── Financial payload (EPIC-FIN-INTEGRATION-003) ─────────────────
            'inventory_class' => $this->inventoryClass->value,
            'quantity' => $this->quantityShipped,
            'unit_cost' => $this->unitCost,
            'extended_cost' => $this->extendedCost(),
            'posting_amount' => $this->extendedCost(),
            'currency' => $this->currency,
            'actor_id' => $this->actorId,
        ];
    }

    private static function generateUuid(): string
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0F) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3F) | 0x80);

        return implode('-', [
            bin2hex(substr($bytes, 0, 4)),
            bin2hex(substr($bytes, 4, 2)),
            bin2hex(substr($bytes, 6, 2)),
            bin2hex(substr($bytes, 8, 2)),
            bin2hex(substr($bytes, 10, 6)),
        ]);
    }
}
