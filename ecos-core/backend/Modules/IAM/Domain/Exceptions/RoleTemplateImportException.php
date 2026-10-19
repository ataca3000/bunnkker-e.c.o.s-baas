<?php

declare(strict_types=1);

namespace Modules\IAM\Domain\Exceptions;

use RuntimeException;

/**
 * Raised when a Role Template import payload is malformed or invalid (ADR-039).
 */
final class RoleTemplateImportException extends RuntimeException
{
    public static function because(string $reason): self
    {
        return new self("Cannot import role template: {$reason}.");
    }
}
