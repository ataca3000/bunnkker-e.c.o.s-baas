<?php

declare(strict_types=1);

namespace Modules\Logistics\Dispatch\Domain\Enums;

/**
 * What kind of clash was detected.
 *
 * Severity lives on the type rather than being passed in, so the same clash is
 * always weighted the same way whichever code path found it.
 */
enum ConflictType: string
{
    case VehicleDoubleBooked = 'vehicle_double_booked';
    case DriverDoubleBooked = 'driver_double_booked';
    case VehicleUnfit = 'vehicle_unfit';
    case DriverUnavailable = 'driver_unavailable';
    case CapacityExceeded = 'capacity_exceeded';
    case ResourceLocked = 'resource_locked';
    case TripAlreadyAssigned = 'trip_already_assigned';
    case PolicyViolation = 'policy_violation';

    public function label(): string
    {
        return match ($this) {
            self::VehicleDoubleBooked => 'Vehicle double-booked',
            self::DriverDoubleBooked => 'Driver double-booked',
            self::VehicleUnfit => 'Vehicle unfit',
            self::DriverUnavailable => 'Driver unavailable',
            self::CapacityExceeded => 'Capacity exceeded',
            self::ResourceLocked => 'Resource locked by another session',
            self::TripAlreadyAssigned => 'Trip already assigned',
            self::PolicyViolation => 'Policy violation',
        };
    }

    /**
     * Blocking conflicts stop a release; advisory ones only warn.
     *
     * Double-booking and an unfit vehicle are physical impossibilities or
     * safety matters. A policy violation is a judgement call a supervisor may
     * legitimately make, so it warns rather than blocks.
     */
    public function severity(): string
    {
        return match ($this) {
            self::VehicleDoubleBooked,
            self::DriverDoubleBooked,
            self::VehicleUnfit,
            self::DriverUnavailable,
            self::TripAlreadyAssigned,
            self::ResourceLocked => 'blocking',

            self::CapacityExceeded,
            self::PolicyViolation => 'advisory',
        };
    }

    public function isBlocking(): bool
    {
        return $this->severity() === 'blocking';
    }

    /**
     * Which module owns the fact behind this conflict. Recorded so the board
     * can route a dispatcher to the right place to fix it — and so Dispatch
     * never re-derives another module's judgement.
     */
    public function authority(): string
    {
        return match ($this) {
            self::VehicleUnfit => 'fleet',
            self::DriverUnavailable => 'drivers',
            self::CapacityExceeded => 'network',
            self::TripAlreadyAssigned => 'distribution',
            default => 'dispatch',
        };
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_map(static fn (self $c) => $c->value, self::cases());
    }

    /** @return list<array{value: string, label: string, severity: string, authority: string}> */
    public static function options(): array
    {
        return array_map(
            static fn (self $c) => [
                'value' => $c->value,
                'label' => $c->label(),
                'severity' => $c->severity(),
                'authority' => $c->authority(),
            ],
            self::cases(),
        );
    }
}
