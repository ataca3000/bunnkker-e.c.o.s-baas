<?php

declare(strict_types=1);

namespace Modules\Logistics\Dispatch\Domain\Enums;

/**
 * An assignment lock.
 *
 * `expired` is separate from `released` because they mean different things
 * operationally: released is a dispatcher finishing, expired is a lock that
 * timed out. A dispatcher who closes their laptop must not hold a vehicle
 * hostage, and the difference is worth counting.
 */
enum LockStatus: string
{
    case Held = 'held';
    case Released = 'released';
    case Expired = 'expired';
    case Broken = 'broken';

    public function label(): string
    {
        return match ($this) {
            self::Held => 'Held',
            self::Released => 'Released',
            self::Expired => 'Expired',
            self::Broken => 'Force-released',
        };
    }

    public function isHeld(): bool
    {
        return $this === self::Held;
    }

    public function isTerminal(): bool
    {
        return $this !== self::Held;
    }

    /** Force-releasing another dispatcher's lock is always audited. */
    public function requiresReason(): bool
    {
        return $this === self::Broken;
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
