<?php

declare(strict_types=1);

namespace Modules\Logistics\Operations\Domain\Enums;

/**
 * Which module owns the fact behind an exception.
 *
 * The vocabulary matches Dispatch's ConflictType::authority() on purpose. An
 * exception raised from a conflict must name the same owner the conflict named,
 * or an operator working the merged queue gets two different answers to "who
 * fixes this?".
 */
enum ExceptionSource: string
{
    case Fleet = 'fleet';
    case Drivers = 'drivers';
    case Network = 'network';
    case Dispatch = 'dispatch';
    case Routing = 'routing';
    case Carriers = 'carriers';
    case Distribution = 'distribution';
    case Delivery = 'delivery';
    case Operations = 'operations';

    public function label(): string
    {
        return match ($this) {
            self::Fleet => 'Fleet',
            self::Drivers => 'Drivers',
            self::Network => 'Network',
            self::Dispatch => 'Dispatch',
            self::Routing => 'Routing',
            self::Carriers => 'Carriers',
            self::Distribution => 'Distribution',
            self::Delivery => 'Delivery',
            self::Operations => 'Operations',
        };
    }

    /**
     * Whether Operations may close this itself.
     *
     * Only exceptions Operations raised about its own state. Everything else is
     * resolved by the module that owns the fact — Operations can record that it
     * was handled, but it cannot make the underlying condition untrue.
     */
    public function isSelfOwned(): bool
    {
        return $this === self::Operations;
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_map(static fn (self $c) => $c->value, self::cases());
    }

    /** @return list<array{value: string, label: string, self_owned: bool}> */
    public static function options(): array
    {
        return array_map(
            static fn (self $c) => [
                'value' => $c->value,
                'label' => $c->label(),
                'self_owned' => $c->isSelfOwned(),
            ],
            self::cases(),
        );
    }
}
