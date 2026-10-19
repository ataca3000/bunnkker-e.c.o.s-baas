<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Events;

use DateTimeImmutable;
use DateTimeInterface;
use DateTimeZone;
use Illuminate\Foundation\Events\Dispatchable;
use Modules\Inventory\DomainEvents\Contracts\DomainEvent;

final class ProductPrepared implements DomainEvent
{
    use Dispatchable;

    private readonly string $eventId;

    private readonly DateTimeImmutable $occurredAt;

    public function __construct(
        public readonly string $waveId,
        public readonly string $companyId,
        public readonly string $waveItemId,
        public readonly string $productId,
        public readonly string $sku,
        public readonly float $quantityRequired,
        public readonly float $quantityPrepared,
        public readonly float $quantityShort,
        public readonly string $status,
        public readonly string $preparedBy,
        public readonly string $preparedAt,
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
        return 'preparation.product.prepared';
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
            'triggered_by' => $this->preparedBy,
            'triggered_by_type' => 'user',
            'payload' => [
                'wave_id' => $this->waveId,
                'wave_item_id' => $this->waveItemId,
                'product_id' => $this->productId,
                'sku' => $this->sku,
                'quantity_required' => $this->quantityRequired,
                'quantity_prepared' => $this->quantityPrepared,
                'quantity_short' => $this->quantityShort,
                'status' => $this->status,
                'prepared_by' => $this->preparedBy,
                'prepared_at' => $this->preparedAt,
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
