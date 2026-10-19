<?php

declare(strict_types=1);

namespace Modules\POS\Shift\Domain\Exceptions;

use DomainException;

final class ShiftNotFoundException extends DomainException
{
    public static function withId(string $id): self
    {
        return new self(sprintf('POS shift with ID "%s" was not found.', $id));
    }
}
