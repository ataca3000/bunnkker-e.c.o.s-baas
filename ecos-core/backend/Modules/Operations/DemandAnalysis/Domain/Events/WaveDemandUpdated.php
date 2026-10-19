<?php

declare(strict_types=1);

namespace Modules\Operations\DemandAnalysis\Domain\Events;

use DateTimeImmutable;
use DateTimeInterface;
use DateTimeZone;
use Illuminate\Foundation\Events\Dispatchable;
use Modules\Inventory\DomainEvents\Contracts\DomainEvent;

final class WaveDemandUpdated implements DomainEvent
{
    use Dispatchable;

    private readonly string $eventId;

    private readonly DateTimeImmutable $occurredAt;

    public function __construct(
        public readonly string $waveId,
        public readonly string $companyId,
        public readonly string $warehouseId,
        public readonly int $ordersCount,
        public readonly int $productsCount,
        public readonly int $materialsCount,
        public readonly int $missingMaterialsCount,
        public readonly float $completionPct,
        public readonly string $trigger,
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
        return 'demand.wave.demand_updated';
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
            'source_module' => 'Operations.DemandAnalysis',
            'occurred_at' => $this->occurredAt->format(DateTimeInterface::ATOM),
            'correlation_id' => $this->correlationId(),
            'payload' => [
                'wave_id' => $this->waveId,
                'warehouse_id' => $this->warehouseId,
                'orders_count' => $this->ordersCount,
                'products_count' => $this->productsCount,
                'materials_count' => $this->materialsCount,
                'missing_materials_count' => $this->missingMaterialsCount,
                'completion_pct' => $this->completionPct,
                'trigger' => $this->trigger,
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
