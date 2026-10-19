<?php

declare(strict_types=1);

namespace Modules\IAM\Application\Services;

use App\Models\User;
use Modules\IAM\Domain\Enums\UserStatus;
use Modules\IAM\Domain\Exceptions\UserSecurityRuleException;

/**
 * Enterprise user-security invariants (ADR-040, Decision 5). Enforced server-side by the
 * lifecycle and role-assignment services — never bypassable from the UI.
 */
class UserSecurityRules
{
    public const SUPER_ADMIN_SLUG = 'super-admin';

    /** A user may not apply a deactivating transition to their own account. */
    public function assertNotSelfDeactivation(?User $actor, User $target, UserStatus $to): void
    {
        if ($actor !== null && $actor->getKey() === $target->getKey() && $to->isDeactivating()) {
            throw UserSecurityRuleException::cannotActOnSelf($to->value);
        }
    }

    /** A user may not remove their own Super Administrator role. */
    public function assertNotRemovingOwnSuperAdmin(?User $actor, User $target, string $roleSlug): void
    {
        if ($actor !== null
            && $actor->getKey() === $target->getKey()
            && $roleSlug === self::SUPER_ADMIN_SLUG) {
            throw UserSecurityRuleException::cannotRemoveOwnSuperAdmin();
        }
    }

    /**
     * The system must always retain at least one ACTIVE Super Administrator. Call BEFORE
     * removing super-admin from / deactivating `target`.
     */
    public function assertNotLastSuperAdmin(User $target): void
    {
        if (! $this->isSuperAdmin($target)) {
            return;
        }

        $remaining = User::query()
            ->where('users.id', '!=', $target->getKey())
            ->where('status', UserStatus::ACTIVE->value)
            ->whereHas('roles', fn ($q) => $q->where('slug', self::SUPER_ADMIN_SLUG))
            ->count();

        if ($remaining === 0) {
            throw UserSecurityRuleException::cannotRemoveLastSuperAdmin();
        }
    }

    public function isSuperAdmin(User $user): bool
    {
        return $user->roles()->where('slug', self::SUPER_ADMIN_SLUG)->exists();
    }
}
