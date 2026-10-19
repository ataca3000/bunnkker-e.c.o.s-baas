<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Events;

use DateTimeImmutable;
use DateTimeInterface;
use DateTimeZone;
use Illuminate\Foundation\Events\Dispatchable;
use Modules\Inventory\DomainEvents\Contracts\DomainEvent;

final class PoolUpdated implements DomainEvent
{
    use Dispatchable;

    private readonly string $eventId;

    private readonly DateTimeImmutable $occurredAt;

    public function __construct(
        public readonly string $poolEntryId,
        public readonly string $productId,
        public readonly string $sku,
        public readonly string $warehouseId,
        public readonly string $preparationWaveId,
        public readonly string $companyId,
        public readonly string $movementType,
        public readonly float $quantityMoved,
        public readonly float $quantityAvailable,
        public readonly float $quantityReserved,
        public readonly string $qualityStatus,
        public readonly string $recordedAt,
        public readonly string $correlationIdValue = '',
    ) {
        $this->eventId = self::uuid();
        $this->occurredAt = new DateTimeImmutable('now', new DateTimeZone('UTC'));
    }

    public function eventId(): string
    {
        return $this->eventId;
    }

    public function eventName(): string
    {
        return 'preparation.pool.updated';
    }

    public function eventVersion(): int
    {
        return 1;
    }

    public function occurredAt(): DateTimeImmutable
    {
        return $this->occurredAt;
    }

    public function correlationId(): string
    {
        return $this->correlationIdValue !== '' ? $this->correlationIdValue : $this->eventId;
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'event_id' => $this->eventId,
            'event_type' => $this->eventName(),
            'event_version' => $this->eventVersion(),
            'aggregate_type' => 'PreparedProductsPool',
            'aggregate_id' => $this->poolEntryId,
            'company_id' => $this->companyId,
            'source_module' => 'Operations.Preparation',
            'occurred_at' => $this->occurredAt->format(DateTimeInterface::ATOM),
            'correlation_id' => $this->correlationId(),
            'triggered_by' => 'system',
            'triggered_by_type' => 'system',
            'payload' => [
                'pool_entry_id' => $this->poolEntryId,
                'product_id' => $this->productId,
                'sku' => $this->sku,
                'warehouse_id' => $this->warehouseId,
                'preparation_wave_id' => $this->preparationWaveId,
                'movement_type' => $this->movementType,
                'quantity_moved' => $this->quantityMoved,
                'quantity_available' => $this->quantityAvailable,
                'quantity_reserved' => $this->quantityReserved,
                'quality_status' => $this->qualityStatus,
                'recorded_at' => $this->recordedAt,
            ],
        ];
    }

    private static function uuid(): string
    {
        $b = random_bytes(16);
        $b[6] = chr((ord($b[6]) & 0x0F) | 0x40);
        $b[8] = chr((ord($b[8]) & 0x3F) | 0x80);

        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($b), 4));
    }
}
