<?php

declare(strict_types=1);

namespace Modules\Logistics\Vehicles\Domain\Enums;

enum MaintenanceType: string
{
    case Routine = 'routine';
    case OilChange = 'oil_change';
    case TyreChange = 'tyre_change';
    case Repair = 'repair';
    case Inspection = 'inspection';
    case Accident = 'accident';
    case Other = 'other';

    public function label(): string
    {
        return match ($this) {
            self::Routine => 'Routine Service',
            self::OilChange => 'Oil Change',
            self::TyreChange => 'Tyre Change',
            self::Repair => 'Repair',
            self::Inspection => 'Inspection',
            self::Accident => 'Accident Repair',
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
