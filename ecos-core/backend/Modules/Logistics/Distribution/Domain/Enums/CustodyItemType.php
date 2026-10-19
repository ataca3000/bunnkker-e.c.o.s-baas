<?php

declare(strict_types=1);

namespace Modules\Logistics\Distribution\Domain\Enums;

/** Equipment and float handed to a driver for the duration of a trip. */
enum CustodyItemType: string
{
    case CashFloat = 'cash_float';
    case PosDevice = 'pos_device';
    case IceBoxes = 'ice_boxes';
    case IcePacks = 'ice_packs';
    case ThermalBags = 'thermal_bags';
    case DeliveryBags = 'delivery_bags';
    case Other = 'other';

    public function label(): string
    {
        return match ($this) {
            self::CashFloat => 'Cash Float',
            self::PosDevice => 'POS Device',
            self::IceBoxes => 'Ice Boxes',
            self::IcePacks => 'Ice Packs',
            self::ThermalBags => 'Thermal Bags',
            self::DeliveryBags => 'Delivery Bags',
            self::Other => 'Other',
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
