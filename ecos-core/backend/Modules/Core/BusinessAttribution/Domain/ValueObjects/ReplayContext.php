<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Domain\ValueObjects;

use Carbon\Carbon;

final readonly class ReplayContext
{
    public function __construct(
        public string $entityType,
        public string $entityId,
        public ?Carbon $from = null,
        public ?Carbon $to = null,
        public ?Carbon $asOf = null,
        public string $purpose = '',
        public string $replayType = 'entity',
        public bool $lazy = false,
        public bool $streaming = false,
        public ?string $userId = null,
        public array $filters = [],
        public int $maxEvents = 10_000,
    ) {}

    public static function entity(string $entityType, string $entityId, ?string $userId = null): self
    {
        return new self(
            entityType: $entityType,
            entityId: $entityId,
            replayType: 'entity',
            userId: $userId,
        );
    }

    public static function journey(string $entityType, string $entityId, ?Carbon $from = null, ?Carbon $to = null): self
    {
        return new self(
            entityType: $entityType,
            entityId: $entityId,
            from: $from,
            to: $to,
            replayType: 'journey',
        );
    }

    public static function atTime(string $entityType, string $entityId, Carbon $asOf): self
    {
        return new self(
            entityType: $entityType,
            entityId: $entityId,
            asOf: $asOf,
            to: $asOf,
            replayType: 'time_machine',
        );
    }

    public static function timeline(string $entityType, string $entityId, Carbon $from, Carbon $to): self
    {
        return new self(
            entityType: $entityType,
            entityId: $entityId,
            from: $from,
            to: $to,
            replayType: 'timeline',
        );
    }

    public static function eventRange(string $entityType, string $entityId, Carbon $from, Carbon $to): self
    {
        return new self(
            entityType: $entityType,
            entityId: $entityId,
            from: $from,
            to: $to,
            replayType: 'event_range',
        );
    }

    public function withPurpose(string $purpose): self
    {
        return new self(
            entityType: $this->entityType,
            entityId: $this->entityId,
            from: $this->from,
            to: $this->to,
            asOf: $this->asOf,
            purpose: $purpose,
            replayType: $this->replayType,
            lazy: $this->lazy,
            streaming: $this->streaming,
            userId: $this->userId,
            filters: $this->filters,
            maxEvents: $this->maxEvents,
        );
    }

    public function withUser(string $userId): self
    {
        return new self(
            entityType: $this->entityType,
            entityId: $this->entityId,
            from: $this->from,
            to: $this->to,
            asOf: $this->asOf,
            purpose: $this->purpose,
            replayType: $this->replayType,
            lazy: $this->lazy,
            streaming: $this->streaming,
            userId: $userId,
            filters: $this->filters,
            maxEvents: $this->maxEvents,
        );
    }
}
