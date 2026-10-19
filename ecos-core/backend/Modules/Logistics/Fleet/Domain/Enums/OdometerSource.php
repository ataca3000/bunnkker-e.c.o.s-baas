<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Domain\Enums;

/**
 * Where an odometer reading came from.
 *
 * Readings arrive from several places and multiple uncoordinated writers
 * guarantee inconsistency, so OdometerService is the single writer and resolves
 * conflicts by the trust order below.
 *
 * `telemetry` is the least trusted deliberately: GPS-derived distance is
 * optional (Directive 5) and must never outrank a physically observed reading.
 */
enum OdometerSource: string
{
    case Maintenance = 'maintenance';
    case FuelStop = 'fuel_stop';
    case Inspection = 'inspection';
    case Manual = 'manual';
    case Telemetry = 'telemetry';

    public function label(): string
    {
        return match ($this) {
            self::Maintenance => 'Maintenance',
            self::FuelStop => 'Fuel Stop',
            self::Inspection => 'Inspection',
            self::Manual => 'Manual Entry',
            self::Telemetry => 'Telemetry',
        };
    }

    /** Higher wins when two readings contend for the same moment. */
    public function trust(): int
    {
        return match ($this) {
            self::Maintenance => 50,
            self::FuelStop => 40,
            self::Inspection => 30,
            self::Manual => 20,
            self::Telemetry => 10,
        };
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
