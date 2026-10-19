<?php

declare(strict_types=1);

namespace Modules\Logistics\Vehicles\Domain\Exceptions;

use Modules\Logistics\Vehicles\Domain\Enums\VehicleStatus;
use RuntimeException;

/**
 * Raised when an operation would violate a vehicle business rule.
 * The presentation layer renders these as HTTP 422.
 */
class VehicleException extends RuntimeException
{
    public static function invalidTransition(VehicleStatus $from, VehicleStatus $to): self
    {
        $allowed = array_map(
            static fn (VehicleStatus $s) => $s->label(),
            $from->allowedTransitions(),
        );

        return new self(sprintf(
            'A vehicle cannot move from %s to %s. Allowed next states: %s.',
            $from->label(),
            $to->label(),
            $allowed === [] ? 'none' : implode(', ', $allowed),
        ));
    }

    public static function availableWhileDriverAssigned(): self
    {
        return new self(
            'This vehicle still has an active driver assignment, so it cannot be marked Available. '
            .'Release the driver first.'
        );
    }

    public static function archivedCannotBeAssigned(string $plate): self
    {
        return new self("Vehicle {$plate} is archived and cannot receive assignments.");
    }

    public static function statusNotOperatorSettable(VehicleStatus $status): self
    {
        return new self(sprintf(
            '%s is derived from driver assignment and trip execution and cannot be set directly.',
            $status->label(),
        ));
    }

    public static function maintenanceImmutable(): self
    {
        return new self(
            'Maintenance records are immutable once created. Amending one requires the '
            .'logistics vehicle-maintenance management permission.'
        );
    }
}
