<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Events;

use DateTimeImmutable;
use DateTimeInterface;
use DateTimeZone;
use Illuminate\Foundation\Events\Dispatchable;
use Modules\Inventory\DomainEvents\Contracts\DomainEvent;

final class OrderAddedToWave implements DomainEvent
{
    use Dispatchable;

    private readonly string $eventId;

    private readonly DateTimeImmutable $occurredAt;

    public function __construct(
        public readonly string $waveId,
        public readonly string $waveNumber,
        public readonly string $companyId,
        public readonly string $warehouseId,
        public readonly string $orderId,
        public readonly string $orderNumber,
        public readonly string $waveStatus,
        public readonly string $addedBy,
        public readonly string $addedAt,
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
        return 'preparation.wave.order_added';
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
            'aggregate_type' => 'PreparationWave',
            'aggregate_id' => $this->waveId,
            'company_id' => $this->companyId,
            'source_module' => 'Operations.Preparation',
            'occurred_at' => $this->occurredAt->format(DateTimeInterface::ATOM),
            'correlation_id' => $this->correlationId(),
            'triggered_by' => $this->addedBy,
            'triggered_by_type' => $this->addedBy === 'system' ? 'system' : 'user',
            'payload' => [
                'wave_id' => $this->waveId,
                'wave_number' => $this->waveNumber,
                'warehouse_id' => $this->warehouseId,
                'order_id' => $this->orderId,
                'order_number' => $this->orderNumber,
                'wave_status' => $this->waveStatus,
                'added_by' => $this->addedBy,
                'added_at' => $this->addedAt,
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
