<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Exceptions;

use RuntimeException;

final class WaveItemNotFoundException extends RuntimeException
{
    public static function forId(string $id): self
    {
        return new self("Preparation wave item [{$id}] not found.");
    }
}
