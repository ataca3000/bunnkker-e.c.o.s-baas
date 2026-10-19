<?php

declare(strict_types=1);

namespace Modules\Logistics\Drivers\Domain\Exceptions;

use RuntimeException;

/**
 * Raised when a driver↔vehicle assignment would violate a business rule.
 * The presentation layer renders these as HTTP 422.
 */
class VehicleAssignmentException extends RuntimeException
{
    public static function driverArchived(): self
    {
        return new self('Archived drivers cannot be assigned a vehicle.');
    }

    public static function vehicleUnavailable(string $plate): self
    {
        return new self("Vehicle {$plate} is not active and cannot be assigned.");
    }

    public static function vehicleTaken(string $plate, string $driver): self
    {
        return new self("Vehicle {$plate} is already assigned to {$driver}. Release it first.");
    }

    public static function alreadyAssignedToSameVehicle(string $plate): self
    {
        return new self("This driver is already assigned to vehicle {$plate}.");
    }

    public static function noActiveAssignment(): self
    {
        return new self('This driver has no active vehicle assignment to release.');
    }
}
