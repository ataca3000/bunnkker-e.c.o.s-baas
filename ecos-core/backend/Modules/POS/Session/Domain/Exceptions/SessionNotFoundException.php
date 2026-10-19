<?php

declare(strict_types=1);

namespace Modules\POS\Session\Domain\Exceptions;

use DomainException;

final class SessionNotFoundException extends DomainException
{
    public static function withId(string $id): self
    {
        return new self(sprintf('POS session with ID "%s" was not found.', $id));
    }
}
