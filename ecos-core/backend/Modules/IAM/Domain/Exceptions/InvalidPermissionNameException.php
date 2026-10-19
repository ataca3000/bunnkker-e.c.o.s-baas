<?php

declare(strict_types=1);

namespace Modules\IAM\Domain\Exceptions;

use InvalidArgumentException;

/**
 * Thrown by {@see \Modules\IAM\Domain\ValueObjects\PermissionName} when a raw
 * string cannot be parsed into a valid `module.resource.action` permission name.
 *
 * Extends the SPL InvalidArgumentException so existing generic catch blocks and
 * validation layers behave unchanged.
 */
final class InvalidPermissionNameException extends InvalidArgumentException
{
    public static function forValue(string $raw, string $why): self
    {
        return new self(sprintf('Invalid permission name "%s": %s', $raw, $why));
    }
}
