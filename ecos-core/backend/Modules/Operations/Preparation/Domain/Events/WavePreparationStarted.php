<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Events;

use DateTimeImmutable;
use DateTimeInterface;
use DateTimeZone;
use Illuminate\Foundation\Events\Dispatchable;
use Modules\Inventory\DomainEvents\Contracts\DomainEvent;

/**
 * Published by the Wave Engine when a Collecting wave automatically transitions to Preparing.
 * Distinct from WaveStarted (manual start action with PickList creation).
 */
final class WavePreparationStarted implements DomainEvent
{
    use Dispatchable;

    private readonly string $eventId;

    private readonly DateTimeImmutable $occurredAt;

    /**
     * @param  list<string>  $orderIds  IDs of all orders in this wave at the moment preparation started.
     */
    public function __construct(
        public readonly string $waveId,
        public readonly string $waveNumber,
        public readonly string $companyId,
        public readonly string $warehouseId,
        public readonly string $planningDate,
        public readonly int $ordersCount,
        public readonly array $orderIds,
        public readonly string $startedBy,
        public readonly string $startedAt,
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
        return 'preparation.wave.preparation_started';
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
            'triggered_by' => $this->startedBy,
            'triggered_by_type' => $this->startedBy === 'system' ? 'system' : 'user',
            'payload' => [
                'wave_id' => $this->waveId,
                'wave_number' => $this->waveNumber,
                'warehouse_id' => $this->warehouseId,
                'planning_date' => $this->planningDate,
                'orders_count' => $this->ordersCount,
                'started_by' => $this->startedBy,
                'started_at' => $this->startedAt,
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
