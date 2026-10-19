<?php

declare(strict_types=1);

namespace Modules\Logistics\Vehicles\Domain\Enums;

enum FuelType: string
{
    case Petrol = 'petrol';
    case Diesel = 'diesel';
    case NaturalGas = 'natural_gas';
    case Hybrid = 'hybrid';
    case Electric = 'electric';

    public function label(): string
    {
        return match ($this) {
            self::Petrol => 'Petrol',
            self::Diesel => 'Diesel',
            self::NaturalGas => 'Natural Gas (CNG)',
            self::Hybrid => 'Hybrid',
            self::Electric => 'Electric',
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
