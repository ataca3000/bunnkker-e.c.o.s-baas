<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Exceptions;

use RuntimeException;

final class LoadingSessionNotFoundException extends RuntimeException
{
    public static function forId(string $id): static
    {
        return new self("Loading session [{$id}] not found.");
    }
}
