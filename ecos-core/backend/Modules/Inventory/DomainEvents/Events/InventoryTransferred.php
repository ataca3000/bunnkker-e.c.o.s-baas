<?php

declare(strict_types=1);

namespace Modules\Inventory\DomainEvents\Events;

use DateTimeImmutable;
use DateTimeInterface;
use DateTimeZone;
use Modules\Inventory\DomainEvents\Contracts\DomainEvent;
use Modules\Inventory\Products\Domain\Enums\InventoryClass;

/**
 * Raised once per successful warehouse transfer, after the DB transaction commits.
 *
 * Publisher: TransferStockAction
 */
final class InventoryTransferred implements DomainEvent
{
    private readonly string $eventId;

    private readonly DateTimeImmutable $occurredAt;

    public function __construct(
        public readonly string $transferId,
        public readonly string $productId,
        public readonly string $companyId,
        public readonly string $sourceWarehouseId,
        public readonly string $destinationWarehouseId,
        public readonly float $quantity,
        public readonly float $totalCost,
        public readonly float $weightedUnitCost,
        public readonly string $transferNumber,
        public readonly InventoryClass $inventoryClass,
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

    public function eventName(): string
    {
        return 'inventory.stock.transferred';
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
            'occurred_at' => $this->occurredAt->format(DateTimeInterface::ATOM),
            'transfer_id' => $this->transferId,
            'transfer_number' => $this->transferNumber,
            'product_id' => $this->productId,
            'company_id' => $this->companyId,
            'source_warehouse_id' => $this->sourceWarehouseId,
            'destination_warehouse_id' => $this->destinationWarehouseId,
            'quantity' => $this->quantity,
            'total_cost' => $this->totalCost,
            'weighted_unit_cost' => $this->weightedUnitCost,

            // ── Financial payload (EPIC-FIN-INTEGRATION-003) ─────────────────
            // A transfer already knew what it was worth; it just never said so
            // in the vocabulary Finance reads.
            'inventory_class' => $this->inventoryClass->value,
            'unit_cost' => $this->weightedUnitCost,
            'extended_cost' => $this->totalCost,
            'posting_amount' => $this->totalCost,
            'warehouse_id' => $this->sourceWarehouseId,
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
