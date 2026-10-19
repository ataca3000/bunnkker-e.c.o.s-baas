<?php

declare(strict_types=1);

namespace Modules\Inventory\DomainEvents\Events;

use DateTimeImmutable;
use DateTimeInterface;
use DateTimeZone;
use Modules\Inventory\DomainEvents\Contracts\DomainEvent;

/**
 * Raised after an inventory count session is approved and adjustments are posted.
 *
 * Publisher : ApproveCountSessionAction (after outermost DB transaction commits)
 * Trigger   : Count session approval by an authorised user
 *
 * Payload contains only scalar IDs — no InventoryCountSession model.
 */
final class InventoryCountApproved implements DomainEvent
{
    private readonly string $eventId;

    private readonly DateTimeImmutable $occurredAt;

    public function __construct(
        public readonly string $countSessionId,
        public readonly string $countNumber,
        public readonly string $warehouseId,
        public readonly string $companyId,
        /** Number of count lines where an adjustment was applied (variance ≠ 0). */
        public readonly int $linesAdjusted,
        public readonly ?string $approvedBy = null,
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
        return 'inventory.count.approved';
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
            'count_session_id' => $this->countSessionId,
            'count_number' => $this->countNumber,
            'warehouse_id' => $this->warehouseId,
            'company_id' => $this->companyId,
            'lines_adjusted' => $this->linesAdjusted,
            'approved_by' => $this->approvedBy,
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
