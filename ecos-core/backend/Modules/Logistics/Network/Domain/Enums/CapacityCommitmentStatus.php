<?php

declare(strict_types=1);

namespace Modules\Logistics\Network\Domain\Enums;

/**
 * `expired` exists so an abandoned checkout cannot silently consume a day's
 * capacity — a failure mode that stays invisible until a zone mysteriously
 * sells out.
 */
enum CapacityCommitmentStatus: string
{
    case Reserved = 'reserved';
    case Committed = 'committed';
    case Consumed = 'consumed';
    case Released = 'released';
    case Expired = 'expired';

    public function label(): string
    {
        return match ($this) {
            self::Reserved => 'Reserved',
            self::Committed => 'Committed',
            self::Consumed => 'Consumed',
            self::Released => 'Released',
            self::Expired => 'Expired',
        };
    }

    /** @return list<self> */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Reserved => [self::Committed, self::Released, self::Expired],
            self::Committed => [self::Consumed, self::Released],
            self::Consumed, self::Released, self::Expired => [],
        };
    }

    public function canTransitionTo(self $target): bool
    {
        return in_array($target, $this->allowedTransitions(), true);
    }

    public function isTerminal(): bool
    {
        return in_array($this, [self::Consumed, self::Released, self::Expired], true);
    }

    /** States that count against a slot's available capacity. */
    public function holdsCapacity(): bool
    {
        return in_array($this, [self::Reserved, self::Committed, self::Consumed], true);
    }

    /** A soft hold that a TTL sweep may reclaim. */
    public function isReclaimable(): bool
    {
        return $this === self::Reserved;
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_map(static fn (self $c) => $c->value, self::cases());
    }

    /** @return list<array{value: string, label: string}> */
    public static function options(): array
    {
        return array_map(
            static fn (self $c) => ['value' => $c->value, 'label' => $c->label()],
            self::cases(),
        );
    }
}
