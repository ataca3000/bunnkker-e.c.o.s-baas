<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Exceptions;

use RuntimeException;

final class VehiclePlanNotFoundException extends RuntimeException
{
    public static function forId(string $id): static
    {
        return new self("Vehicle plan [{$id}] not found.");
    }
}
