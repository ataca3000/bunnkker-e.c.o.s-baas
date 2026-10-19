<?php

declare(strict_types=1);

namespace Modules\Logistics\Vehicles\Domain\Enums;

/**
 * Fleet vehicle classes.
 *
 * Ordered smallest to largest so `values()` drives a sensible picker without
 * the UI needing its own ordering table.
 */
enum VehicleType: string
{
    case Motorcycle = 'motorcycle';
    case Car = 'car';
    case Van = 'van';
    case Pickup = 'pickup';
    case SmallTruck = 'small_truck';
    case MediumTruck = 'medium_truck';
    case LargeTruck = 'large_truck';

    public function label(): string
    {
        return match ($this) {
            self::Motorcycle => 'Motorcycle',
            self::Car => 'Car',
            self::Van => 'Van',
            self::Pickup => 'Pickup',
            self::SmallTruck => 'Small Truck',
            self::MediumTruck => 'Medium Truck',
            self::LargeTruck => 'Large Truck',
        };
    }

    /** Indicative default order capacity, used to pre-fill the create form. */
    public function defaultCapacityOrders(): int
    {
        return match ($this) {
            self::Motorcycle => 15,
            self::Car => 25,
            self::Van => 60,
            self::Pickup => 80,
            self::SmallTruck => 120,
            self::MediumTruck => 220,
            self::LargeTruck => 400,
        };
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_map(static fn (self $c) => $c->value, self::cases());
    }

    /** @return list<array{value: string, label: string, default_capacity_orders: int}> */
    public static function options(): array
    {
        return array_map(
            static fn (self $c) => [
                'value' => $c->value,
                'label' => $c->label(),
                'default_capacity_orders' => $c->defaultCapacityOrders(),
            ],
            self::cases(),
        );
    }
}
