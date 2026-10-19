<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Events;

use DateTimeImmutable;
use DateTimeInterface;
use DateTimeZone;
use Illuminate\Foundation\Events\Dispatchable;
use Modules\Inventory\DomainEvents\Contracts\DomainEvent;

final class WaveCompleted implements DomainEvent
{
    use Dispatchable;

    private readonly string $eventId;

    private readonly DateTimeImmutable $occurredAt;

    /**
     * @param  list<array{product_id:string,sku:string,quantity_short:float}>  $shortItems
     */
    public function __construct(
        public readonly string $waveId,
        public readonly string $waveNumber,
        public readonly string $companyId,
        public readonly string $warehouseId,
        public readonly string $planningDate,
        public readonly string $completedBy,
        public readonly string $completedAt,
        public readonly string $startedAt,
        public readonly int $durationMinutes,
        public readonly int $ordersCount,
        public readonly int $productsCount,
        public readonly float $totalUnitsRequired,
        public readonly float $totalUnitsPrepared,
        public readonly float $completionPct,
        public readonly array $shortItems = [],
        public readonly int $poolEntriesCreated = 0,
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
        return 'preparation.wave.completed';
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
            'triggered_by' => $this->completedBy,
            'triggered_by_type' => 'user',
            'payload' => [
                'wave_id' => $this->waveId,
                'wave_number' => $this->waveNumber,
                'warehouse_id' => $this->warehouseId,
                'planning_date' => $this->planningDate,
                'completed_by' => $this->completedBy,
                'completed_at' => $this->completedAt,
                'started_at' => $this->startedAt,
                'duration_minutes' => $this->durationMinutes,
                'orders_count' => $this->ordersCount,
                'products_count' => $this->productsCount,
                'total_units_required' => $this->totalUnitsRequired,
                'total_units_prepared' => $this->totalUnitsPrepared,
                'completion_pct' => $this->completionPct,
                'short_items' => $this->shortItems,
                'pool_entries_created' => $this->poolEntriesCreated,
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
