<?php

declare(strict_types=1);

namespace Modules\Logistics\Vehicles\Domain\Enums;

/**
 * Vehicle lifecycle state.
 *
 * The transition table is the single authority on what may follow what; the
 * service layer refuses anything not listed here, so an invalid state can
 * never be reached through the API.
 *
 * Notable edges:
 *  - Assigned is reached by assigning a driver, not by a direct status call.
 *  - OutOfService cannot jump straight back to Available: a vehicle taken off
 *    the road returns through Maintenance so the reason is always recorded.
 *  - Archived restores to OutOfService, never directly into service — the same
 *    "restore then explicitly activate" convention used by TASK-LOG-001/002.
 */
enum VehicleStatus: string
{
    case Available = 'available';
    case Assigned = 'assigned';
    case InDelivery = 'in_delivery';
    case Maintenance = 'maintenance';
    case OutOfService = 'out_of_service';
    case Archived = 'archived';

    public function label(): string
    {
        return match ($this) {
            self::Available => 'Available',
            self::Assigned => 'Assigned',
            self::InDelivery => 'In Delivery',
            self::Maintenance => 'Maintenance',
            self::OutOfService => 'Out of Service',
            self::Archived => 'Archived',
        };
    }

    /**
     * States an operator may set directly. Assigned and InDelivery are derived
     * from driver assignment and trip execution respectively.
     *
     * @return list<self>
     */
    public static function operatorSettable(): array
    {
        return [self::Available, self::Maintenance, self::OutOfService, self::Archived];
    }

    /** @return list<self> */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Available => [self::Assigned, self::Maintenance, self::OutOfService, self::Archived],
            self::Assigned => [self::Available, self::InDelivery, self::Maintenance, self::OutOfService, self::Archived],
            self::InDelivery => [self::Assigned, self::Available, self::Maintenance, self::OutOfService],
            self::Maintenance => [self::Available, self::OutOfService, self::Archived],
            // Deliberately excludes Available — see the class docblock.
            self::OutOfService => [self::Maintenance, self::Archived],
            self::Archived => [self::OutOfService],
        };
    }

    public function canTransitionTo(self $target): bool
    {
        return in_array($target, $this->allowedTransitions(), true);
    }

    public function isArchived(): bool
    {
        return $this === self::Archived;
    }

    /** True when the vehicle currently holds a driver or is on the road. */
    public function isEngaged(): bool
    {
        return in_array($this, [self::Assigned, self::InDelivery], true);
    }

    /** True when the vehicle may take a new driver assignment. */
    public function acceptsAssignment(): bool
    {
        return $this === self::Available;
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
