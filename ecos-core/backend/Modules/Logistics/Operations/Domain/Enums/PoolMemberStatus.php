<?php

declare(strict_types=1);

namespace Modules\Logistics\Operations\Domain\Enums;

/**
 * A membership's lifecycle — NOT the resource's readiness.
 *
 * Suspended means "this pool is not drawing on it right now". It says nothing
 * about whether the vehicle is roadworthy; Fleet answers that, and the two must
 * never be conflated, or a supervisor will read a suspended membership as a
 * safety verdict.
 */
enum PoolMemberStatus: string
{
    case Active = 'active';
    case Suspended = 'suspended';
    case Withdrawn = 'withdrawn';

    public function label(): string
    {
        return match ($this) {
            self::Active => 'In pool',
            self::Suspended => 'Held out',
            self::Withdrawn => 'Removed',
        };
    }

    public function tone(): string
    {
        return match ($this) {
            self::Active => 'success',
            self::Suspended => 'warning',
            self::Withdrawn => 'neutral',
        };
    }

    /** Withdrawn frees the resource to join another pool. */
    public function isLive(): bool
    {
        return $this !== self::Withdrawn;
    }

    /** @return list<self> */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Active => [self::Suspended, self::Withdrawn],
            self::Suspended => [self::Active, self::Withdrawn],
            self::Withdrawn => [],
        };
    }

    public function canTransitionTo(self $target): bool
    {
        return in_array($target, $this->allowedTransitions(), true);
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_map(static fn (self $c) => $c->value, self::cases());
    }

    /** @return list<array{value: string, label: string, tone: string}> */
    public static function options(): array
    {
        return array_map(
            static fn (self $c) => ['value' => $c->value, 'label' => $c->label(), 'tone' => $c->tone()],
            self::cases(),
        );
    }
}
