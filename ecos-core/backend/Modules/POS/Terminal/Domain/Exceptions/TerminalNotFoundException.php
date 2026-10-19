<?php

declare(strict_types=1);

namespace Modules\POS\Terminal\Domain\Exceptions;

use DomainException;

final class TerminalNotFoundException extends DomainException
{
    public static function withId(string $id): self
    {
        return new self("Terminal with ID \"{$id}\" not found.");
    }

    public static function withCode(string $code): self
    {
        return new self("Terminal with code \"{$code}\" not found.");
    }
}
