<?php

declare(strict_types=1);

namespace Modules\Logistics\Distribution\Domain\Enums;

/**
 * How a trip is resourced.
 *
 * ExternalCarrier is expressed through the approved Shipping Companies
 * aggregate (type = external), not through a Distribution-owned carrier table.
 */
enum TripType: string
{
    case CompanyVehicle = 'company_vehicle';
    case PersonalVehicle = 'personal_vehicle';
    case ExternalCarrier = 'external_carrier';

    public function label(): string
    {
        return match ($this) {
            self::CompanyVehicle => 'Company Vehicle',
            self::PersonalVehicle => 'Personal Vehicle',
            self::ExternalCarrier => 'External Carrier',
        };
    }

    /** External-carrier trips are run by a 3PL, so no internal pairing is required. */
    public function requiresDriverVehicleAssignment(): bool
    {
        return $this !== self::ExternalCarrier;
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
