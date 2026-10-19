<?php

declare(strict_types=1);

namespace Modules\Logistics\Network\Domain\Enums;

/**
 * Capacity is MULTI-DIMENSIONAL.
 *
 * A single "capacity" integer would be wrong for half the catalogue: a van full
 * of pillows hits volume long before weight, and a van full of tiles hits weight
 * long before order count. The binding constraint differs by product mix, so
 * every dimension is tracked and the tightest one decides.
 */
enum CapacityUnit: string
{
    case Orders = 'orders';
    case Stops = 'stops';
    case WeightKg = 'weight_kg';
    case VolumeM3 = 'volume_m3';

    public function label(): string
    {
        return match ($this) {
            self::Orders => 'Orders',
            self::Stops => 'Stops',
            self::WeightKg => 'Weight',
            self::VolumeM3 => 'Volume',
        };
    }

    public function unit(): string
    {
        return match ($this) {
            self::Orders => 'orders',
            self::Stops => 'stops',
            self::WeightKg => 'kg',
            self::VolumeM3 => 'm³',
        };
    }

    /** Column suffix used by the available_/committed_ column pairs. */
    public function column(): string
    {
        return $this->value;
    }

    public function precision(): int
    {
        return match ($this) {
            self::Orders, self::Stops => 0,
            self::WeightKg => 2,
            self::VolumeM3 => 3,
        };
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_map(static fn (self $c) => $c->value, self::cases());
    }

    /** @return list<array{value: string, label: string, unit: string}> */
    public static function options(): array
    {
        return array_map(
            static fn (self $c) => [
                'value' => $c->value,
                'label' => $c->label(),
                'unit' => $c->unit(),
            ],
            self::cases(),
        );
    }
}
