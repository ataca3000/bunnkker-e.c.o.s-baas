<?php

declare(strict_types=1);

namespace Modules\IAM\Application\Services;

use App\Models\User;
use Modules\IAM\Domain\Enums\UserStatus;
use Modules\IAM\Domain\Exceptions\InvalidUserTransitionException;

/**
 * The user lifecycle state machine (ADR-040, Decision 3). Every transition is validated,
 * security-checked, timestamped, and audited. Status is never written by raw column update.
 */
class UserLifecycleService
{
    public function __construct(
        private readonly UserSecurityRules $security,
        private readonly UserAuditService $audit,
    ) {}

    public function transition(User $user, UserStatus $to, ?User $actor = null, ?string $reason = null): User
    {
        $from = $user->statusEnum();

        if ($from === $to) {
            return $user;
        }

        if (! $from->canTransitionTo($to)) {
            throw InvalidUserTransitionException::between($from, $to);
        }

        // Security invariants (ADR-040, Decision 5).
        $this->security->assertNotSelfDeactivation($actor, $user, $to);
        if ($to->isDeactivating()) {
            $this->security->assertNotLastSuperAdmin($user);
        }

        $user->status = $to->value;
        $this->stampTimestamps($user, $to);
        $user->save();

        if ($to === UserStatus::DELETED) {
            $user->delete(); // soft delete
        }

        $this->audit->log('status_changed', $user, ['status' => $from->value], ['status' => $to->value], ['reason' => $reason]);

        return $user;
    }

    public function activate(User $user, ?User $actor = null): User
    {
        return $this->transition($user, UserStatus::ACTIVE, $actor);
    }

    public function deactivate(User $user, ?User $actor = null, ?string $reason = null): User
    {
        return $this->transition($user, UserStatus::INACTIVE, $actor, $reason);
    }

    public function suspend(User $user, ?User $actor = null, ?string $reason = null): User
    {
        return $this->transition($user, UserStatus::SUSPENDED, $actor, $reason);
    }

    public function lock(User $user, ?User $actor = null, ?string $reason = null): User
    {
        return $this->transition($user, UserStatus::LOCKED, $actor, $reason);
    }

    public function unlock(User $user, ?User $actor = null): User
    {
        $user->failed_login_count = 0;

        return $this->transition($user, UserStatus::ACTIVE, $actor);
    }

    public function archive(User $user, ?User $actor = null, ?string $reason = null): User
    {
        return $this->transition($user, UserStatus::ARCHIVED, $actor, $reason);
    }

    public function restore(User $user, ?User $actor = null): User
    {
        if ($user->trashed()) {
            $user->restore();
        }

        return $this->transition($user, UserStatus::ACTIVE, $actor);
    }

    public function softDelete(User $user, ?User $actor = null, ?string $reason = null): User
    {
        return $this->transition($user, UserStatus::DELETED, $actor, $reason);
    }

    private function stampTimestamps(User $user, UserStatus $to): void
    {
        match ($to) {
            UserStatus::ACTIVE => $user->activated_at = $user->activated_at ?? now(),
            UserStatus::LOCKED => $user->locked_at = now(),
            UserStatus::SUSPENDED => $user->suspended_at = now(),
            UserStatus::ARCHIVED => $user->archived_at = now(),
            default => null,
        };
    }
}
