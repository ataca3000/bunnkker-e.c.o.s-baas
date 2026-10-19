<?php

declare(strict_types=1);

namespace Modules\Logistics\Network\Domain\Enums;

use Modules\Logistics\Distribution\Domain\Models\DistributionZone;
use Modules\Logistics\Geography\Domain\Models\City;
use Modules\Logistics\Geography\Domain\Models\Governorate;

/**
 * What a service area is COMPOSED OF.
 *
 * ┌─ DIRECTIVE 4/8 — NO DUPLICATE GEOGRAPHY ────────────────────────────────┐
 * │ A ServiceArea never stores a place. It references rows that already      │
 * │ exist: distribution_zones (LOG-004B), logistics_cities and               │
 * │ logistics_governorates (Geography). If a member ever grows a `name` or   │
 * │ coordinate column, the boundary has been broken.                         │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
enum CoverageMemberType: string
{
    case Zone = 'zone';
    case City = 'city';
    case Governorate = 'governorate';

    public function label(): string
    {
        return match ($this) {
            self::Zone => 'Distribution Zone',
            self::City => 'City',
            self::Governorate => 'Governorate',
        };
    }

    /** The V1 table this member type points at. Read-only from Network. */
    public function table(): string
    {
        return match ($this) {
            self::Zone => 'distribution_zones',
            self::City => 'logistics_cities',
            self::Governorate => 'logistics_governorates',
        };
    }

    /** @return class-string */
    public function modelClass(): string
    {
        return match ($this) {
            self::Zone => DistributionZone::class,
            self::City => City::class,
            self::Governorate => Governorate::class,
        };
    }

    /**
     * Broader members are resolved first when an address could match several,
     * so the most specific membership wins: city beats zone beats governorate.
     */
    public function specificity(): int
    {
        return match ($this) {
            self::City => 30,
            self::Zone => 20,
            self::Governorate => 10,
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
