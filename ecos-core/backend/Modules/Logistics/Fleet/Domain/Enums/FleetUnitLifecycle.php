<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Domain\Enums;

/**
 * The long-horizon commercial state of a vehicle in the fleet.
 *
 * Deliberately NOT the same axis as LOG-003's VehicleStatus, which is the
 * day-to-day operational state and remains owned by the Vehicles module. A
 * vehicle can be `available` operationally while its FleetUnit is `suspended`
 * commercially — in which case the fitness verdict is `unfit` and Dispatch will
 * not propose it, without Fleet ever writing VehicleStatus.
 */
enum FleetUnitLifecycle: string
{
    case Draft = 'draft';
    case Commissioning = 'commissioning';
    case Active = 'active';
    case Suspended = 'suspended';
    case Decommissioning = 'decommissioning';
    case Retired = 'retired';

    public function label(): string
    {
        return match ($this) {
            self::Draft => 'Draft',
            self::Commissioning => 'Commissioning',
            self::Active => 'Active',
            self::Suspended => 'Suspended',
            self::Decommissioning => 'Decommissioning',
            self::Retired => 'Retired',
        };
    }

    /** @return list<self> */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Draft => [self::Commissioning, self::Retired],
            self::Commissioning => [self::Active, self::Draft, self::Retired],
            self::Active => [self::Suspended, self::Decommissioning],
            self::Suspended => [self::Active, self::Decommissioning],
            self::Decommissioning => [self::Retired, self::Active],
            self::Retired => [],
        };
    }

    public function canTransitionTo(self $target): bool
    {
        return in_array($target, $this->allowedTransitions(), true);
    }

    public function isTerminal(): bool
    {
        return $this === self::Retired;
    }

    /** Only an active unit may ever be proposed for dispatch. */
    public function isDispatchable(): bool
    {
        return $this === self::Active;
    }

    /** States that require an explicit reason to enter. */
    public function requiresReason(): bool
    {
        return in_array($this, [self::Suspended, self::Decommissioning, self::Retired], true);
    }

    public function tone(): string
    {
        return match ($this) {
            self::Active => 'success',
            self::Commissioning => 'info',
            self::Suspended, self::Decommissioning => 'warning',
            self::Draft, self::Retired => 'neutral',
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
