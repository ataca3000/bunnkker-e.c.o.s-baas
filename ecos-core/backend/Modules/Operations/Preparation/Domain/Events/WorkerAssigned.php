<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Events;

use DateTimeImmutable;
use DateTimeInterface;
use DateTimeZone;
use Illuminate\Foundation\Events\Dispatchable;
use Modules\Inventory\DomainEvents\Contracts\DomainEvent;

final class WorkerAssigned implements DomainEvent
{
    use Dispatchable;

    private readonly string $eventId;

    private readonly DateTimeImmutable $occurredAt;

    public function __construct(
        public readonly string $waveId,
        public readonly string $waveNumber,
        public readonly string $companyId,
        public readonly string $userId,
        public readonly string $userName,
        public readonly string $role,
        public readonly string $assignedBy,
        public readonly string $assignedAt,
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
        return 'preparation.worker.assigned';
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
            'triggered_by' => $this->assignedBy,
            'triggered_by_type' => 'user',
            'payload' => [
                'wave_id' => $this->waveId,
                'wave_number' => $this->waveNumber,
                'user_id' => $this->userId,
                'user_name' => $this->userName,
                'role' => $this->role,
                'assigned_by' => $this->assignedBy,
                'assigned_at' => $this->assignedAt,
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
