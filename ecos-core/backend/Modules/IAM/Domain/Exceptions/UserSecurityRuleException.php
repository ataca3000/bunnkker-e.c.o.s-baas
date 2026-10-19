<?php

declare(strict_types=1);

namespace Modules\IAM\Domain\Exceptions;

use RuntimeException;

/**
 * Raised when an operation would violate an enterprise user-security rule (ADR-040, Decision 5):
 * self-deactivation, removing one's own super-admin role, or removing the last super-admin.
 */
final class UserSecurityRuleException extends RuntimeException
{
    public static function cannotActOnSelf(string $action): self
    {
        return new self("You cannot {$action} your own account.");
    }

    public static function cannotRemoveOwnSuperAdmin(): self
    {
        return new self('You cannot remove your own Super Administrator role.');
    }

    public static function cannotRemoveLastSuperAdmin(): self
    {
        return new self('Cannot remove or deactivate the last active Super Administrator.');
    }
}
