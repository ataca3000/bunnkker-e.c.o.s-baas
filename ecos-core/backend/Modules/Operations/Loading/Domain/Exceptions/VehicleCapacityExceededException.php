<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Exceptions;

use RuntimeException;

final class VehicleCapacityExceededException extends RuntimeException
{
    public static function forWeight(float $planned, float $max): static
    {
        return new self(
            sprintf(
                'Vehicle weight capacity exceeded: planned %.4f kg exceeds maximum %.4f kg.',
                $planned,
                $max,
            ),
        );
    }

    public static function forVolume(float $planned, float $max): static
    {
        return new static(
            sprintf(
                'Vehicle volume capacity exceeded: planned %.4f m³ exceeds maximum %.4f m³.',
                $planned,
                $max,
            ),
        );
    }

    public static function forOrders(int $count, int $max): static
    {
        return new static(
            sprintf(
                'Vehicle order capacity exceeded: %d orders exceeds maximum of %d orders.',
                $count,
                $max,
            ),
        );
    }
}
