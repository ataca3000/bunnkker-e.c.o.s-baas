<?php

declare(strict_types=1);

namespace Modules\IAM\Application\Services;

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Modules\IAM\Domain\Enums\UserStatus;
use Modules\IAM\Domain\Models\UserInvitation;

/**
 * Invitation / activation flow (ADR-040): create → invite → activation token → password
 * setup → first login. Only the token HASH is persisted; the raw token is returned once
 * (for the activation link / email) and never stored or logged.
 */
class UserInvitationService
{
    public function __construct(
        private readonly UserLifecycleService $lifecycle,
        private readonly UserAuditService $audit,
    ) {}

    /**
     * Issue an invitation. Returns the RAW token (caller sends it; it is never persisted).
     */
    public function invite(User $user, ?int $actorId = null, int $ttlHours = 72): string
    {
        $raw = Str::random(64);

        // Revoke any outstanding invitations first.
        UserInvitation::where('user_id', $user->getKey())
            ->where('status', UserInvitation::STATUS_PENDING)
            ->update(['status' => UserInvitation::STATUS_REVOKED]);

        UserInvitation::create([
            'user_id' => $user->getKey(),
            'email' => $user->email,
            'token_hash' => hash('sha256', $raw),
            'status' => UserInvitation::STATUS_PENDING,
            'expires_at' => now()->addHours($ttlHours),
            'invited_by' => $actorId,
        ]);

        $user->invited_at = now();
        $user->invited_by = $actorId;
        $user->save();

        if ($user->statusEnum() === UserStatus::DRAFT) {
            $this->lifecycle->transition($user, UserStatus::INVITED);
        }

        $this->audit->log('invited', $user, [], ['email' => $user->email]);

        return $raw;
    }

    /** Look up a pending, unexpired invitation by its raw token. */
    public function findValidInvitation(string $rawToken): ?UserInvitation
    {
        $invitation = UserInvitation::where('token_hash', hash('sha256', $rawToken))
            ->where('status', UserInvitation::STATUS_PENDING)
            ->first();

        if ($invitation === null || $invitation->isExpired()) {
            return null;
        }

        return $invitation;
    }

    /**
     * Complete activation: set the password, mark the invitation accepted, activate the user.
     */
    public function activate(string $rawToken, string $newPassword, bool $requireChangeOnFirstLogin = false): User
    {
        $invitation = $this->findValidInvitation($rawToken);
        if ($invitation === null) {
            throw new \InvalidArgumentException('Invitation is invalid or has expired.');
        }

        /** @var User $user */
        $user = $invitation->user;
        $user->password = Hash::make($newPassword);
        $user->password_changed_at = now();
        $user->require_password_change = $requireChangeOnFirstLogin;
        $user->email_verified_at = $user->email_verified_at ?? now();
        $user->save();

        $invitation->status = UserInvitation::STATUS_ACCEPTED;
        $invitation->accepted_at = now();
        $invitation->save();

        $this->lifecycle->transition($user, UserStatus::ACTIVE);
        $this->audit->log('activated', $user, [], []);

        return $user->refresh();
    }
}
