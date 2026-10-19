<?php

declare(strict_types=1);

namespace Modules\Logistics\Operations\Domain\Enums;

/**
 * Which module owns the resource behind a membership row.
 *
 * The authority is named on the enum so that every screen showing a member can
 * say where its readiness verdict came from — and so nothing here is tempted to
 * derive that verdict itself.
 */
enum PoolMemberType: string
{
    case Vehicle = 'vehicle';
    case Driver = 'driver';

    public function label(): string
    {
        return match ($this) {
            self::Vehicle => 'Vehicle',
            self::Driver => 'Driver',
        };
    }

    /** Who decides whether this member can work today. */
    public function readinessAuthority(): string
    {
        return match ($this) {
            // Fleet's FitnessVerdict, combined with LOG-003's operational status.
            self::Vehicle => 'fleet',
            // LOG-002's Driver::canStartDeliveries().
            self::Driver => 'drivers',
        };
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_map(static fn (self $c) => $c->value, self::cases());
    }

    /** @return list<array{value: string, label: string, readiness_authority: string}> */
    public static function options(): array
    {
        return array_map(
            static fn (self $c) => [
                'value' => $c->value,
                'label' => $c->label(),
                'readiness_authority' => $c->readinessAuthority(),
            ],
            self::cases(),
        );
    }
}
