<?php

declare(strict_types=1);

namespace Modules\Inventory\DomainEvents\Events;

use DateTimeImmutable;
use DateTimeInterface;
use DateTimeZone;
use Modules\Inventory\DomainEvents\Contracts\DomainEvent;
use Modules\Inventory\Products\Domain\Enums\InventoryClass;

/**
 * Raised after a positive or negative inventory adjustment is posted.
 *
 * Publishers:
 *   - AdjustmentInAction  (adjustment_type = 'in',  after DB transaction commits)
 *   - AdjustmentOutAction (adjustment_type = 'out', after DB transaction commits)
 *
 * Trigger: Manual stock adjustment, physical count variance correction
 *
 * NOTE (Phase A limitation): When called from ApproveCountSessionAction, this
 * event is published after the inner savepoint releases — not after the outer
 * transaction commits. Phase B will introduce a PendingDomainEvents collector
 * to guarantee post-outermost-commit publishing in all nested-transaction cases.
 */
final class InventoryStockAdjusted implements DomainEvent
{
    public const TYPE_IN = 'in';

    public const TYPE_OUT = 'out';

    private readonly string $eventId;

    private readonly DateTimeImmutable $occurredAt;

    public function __construct(
        public readonly string $inventoryItemId,
        public readonly string $warehouseId,
        public readonly string $productId,
        public readonly string $companyId,
        /** 'in' for AdjustmentIn, 'out' for AdjustmentOut */
        public readonly string $adjustmentType,
        public readonly float $quantity,
        public readonly float $onHandBefore,
        public readonly float $onHandAfter,
        public readonly InventoryClass $inventoryClass,
        /**
         * The value of one unit of the stock that moved.
         *
         * For an increase this is a figure someone stated — never a running
         * average, never a FIFO lookup. Stock appearing from nowhere has no
         * market price to discover, so the only honest source is the person
         * recording it (EPIC-FIN-INTEGRATION-003A, Decision 2).
         */
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

    /** The value of the stock that moved, derived from the quantity that moved. */
    public function extendedCost(): float
    {
        return round($this->quantity * $this->unitCost, 4);
    }

    public function eventName(): string
    {
        return 'inventory.stock.adjusted';
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
            'adjustment_type' => $this->adjustmentType,
            'quantity' => $this->quantity,
            'on_hand_before' => $this->onHandBefore,
            'on_hand_after' => $this->onHandAfter,
            'reference_type' => $this->referenceType,
            'reference_id' => $this->referenceId,

            // ── Financial payload (EPIC-FIN-INTEGRATION-003) ─────────────────
            // 'quantity' is already emitted above and is the same figure.
            'inventory_class' => $this->inventoryClass->value,
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
