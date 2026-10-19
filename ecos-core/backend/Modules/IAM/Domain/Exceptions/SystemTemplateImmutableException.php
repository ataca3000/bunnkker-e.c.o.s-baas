<?php

declare(strict_types=1);

namespace Modules\IAM\Domain\Exceptions;

use RuntimeException;

/**
 * Raised when code attempts to edit or delete an official ECOS system template.
 * System templates are immutable — clone to a custom template instead (ADR-039, Decision 5).
 */
final class SystemTemplateImmutableException extends RuntimeException
{
    public static function forKey(string $key): self
    {
        return new self("Role template '{$key}' is a system template and cannot be modified. Clone it to a custom template instead.");
    }
}
