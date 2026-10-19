<?php

declare(strict_types=1);

namespace Modules\POS\Promotion\Domain\Events;

use DateTimeImmutable;
use DateTimeZone;
use Modules\POS\Shared\Domain\Contracts\DomainEvent;

final readonly class PromotionCreated implements DomainEvent
{
    public function __construct(
        private string $eventId,
        private DateTimeImmutable $occurredAt,
        public string $promotionId,
        public string $name,
        public string $status,
        public int $conditionCount,
        public string $rewardType,
        public string $validFrom,
        public ?string $validUntil,
        public ?int $maxUses,
        public int $priority,
    ) {}

    public static function now(
        string $promotionId,
        string $name,
        string $status,
        int $conditionCount,
        string $rewardType,
        string $validFrom,
        ?string $validUntil,
        ?int $maxUses,
        int $priority,
    ): self {
        return new self(
            eventId: self::generateUuid(),
            occurredAt: new DateTimeImmutable('now', new DateTimeZone('UTC')),
            promotionId: $promotionId,
            name: $name,
            status: $status,
            conditionCount: $conditionCount,
            rewardType: $rewardType,
            validFrom: $validFrom,
            validUntil: $validUntil,
            maxUses: $maxUses,
            priority: $priority,
        );
    }

    public function eventId(): string
    {
        return $this->eventId;
    }

    public function eventName(): string
    {
        return 'pos.promotion.created';
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
        return $this->eventId;
    }

    public function toArray(): array
    {
        return [
            'event_id' => $this->eventId,
            'event_name' => $this->eventName(),
            'occurred_at' => $this->occurredAt->format(DATE_ATOM),
            'event_version' => $this->eventVersion(),
            'correlation_id' => $this->correlationId(),
            'promotion_id' => $this->promotionId,
            'name' => $this->name,
            'status' => $this->status,
            'condition_count' => $this->conditionCount,
            'reward_type' => $this->rewardType,
            'valid_from' => $this->validFrom,
            'valid_until' => $this->validUntil,
            'max_uses' => $this->maxUses,
            'priority' => $this->priority,
        ];
    }

    private static function generateUuid(): string
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0F) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3F) | 0x80);

        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
    }
}
