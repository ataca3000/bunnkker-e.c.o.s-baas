<?php

declare(strict_types=1);

namespace Modules\Logistics\Operations\Domain\Enums;

/**
 * What a pool is made of.
 *
 * A mixed pool is not two pools stapled together: a dispatcher planning a shift
 * needs vehicles and drivers considered as one supply, because either running
 * short blocks the same trips.
 */
enum PoolType: string
{
    case Vehicle = 'vehicle';
    case Driver = 'driver';
    case Mixed = 'mixed';

    public function label(): string
    {
        return match ($this) {
            self::Vehicle => 'Vehicles',
            self::Driver => 'Drivers',
            self::Mixed => 'Vehicles and drivers',
        };
    }

    /** @return list<string> Member types this pool may hold. */
    public function memberTypes(): array
    {
        return match ($this) {
            self::Vehicle => [PoolMemberType::Vehicle->value],
            self::Driver => [PoolMemberType::Driver->value],
            self::Mixed => [PoolMemberType::Vehicle->value, PoolMemberType::Driver->value],
        };
    }

    public function accepts(PoolMemberType $type): bool
    {
        return in_array($type->value, $this->memberTypes(), true);
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
