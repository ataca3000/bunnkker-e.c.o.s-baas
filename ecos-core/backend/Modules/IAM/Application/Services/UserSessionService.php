<?php

declare(strict_types=1);

namespace Modules\IAM\Application\Services;

use App\Models\User;
use Illuminate\Support\Collection;
use Laravel\Sanctum\PersonalAccessToken;
use Modules\IAM\Domain\Models\UserSession;

/**
 * Device/session management (ADR-040) on top of Sanctum tokens. Records login metadata and
 * powers force-logout / logout-others by revoking the associated personal access tokens.
 */
class UserSessionService
{
    public function __construct(private readonly UserAuditService $audit) {}

    public function record(User $user, ?int $tokenId, ?string $ip, ?string $userAgent): UserSession
    {
        return UserSession::create([
            'user_id' => $user->getKey(),
            'token_id' => $tokenId,
            'ip_address' => $ip,
            'user_agent' => $userAgent !== null ? substr($userAgent, 0, 500) : null,
            'browser' => $this->browser($userAgent),
            'platform' => $this->platform($userAgent),
            'login_at' => now(),
            'last_activity_at' => now(),
        ]);
    }

    /** @return Collection<int,UserSession> */
    public function activeSessions(User $user): Collection
    {
        return UserSession::where('user_id', $user->getKey())
            ->whereNull('revoked_at')
            ->orderByDesc('last_activity_at')
            ->get();
    }

    public function revoke(UserSession $session): void
    {
        $session->revoked_at = now();
        $session->save();

        if ($session->token_id !== null) {
            PersonalAccessToken::whereKey($session->token_id)->delete();
        }
    }

    /** Revoke every session/token for the user (force logout everywhere). */
    public function forceLogout(User $user): int
    {
        $count = 0;
        foreach ($this->activeSessions($user) as $session) {
            $this->revoke($session);
            $count++;
        }
        $user->tokens()->delete();
        $this->audit->log('force_logout', $user, [], ['sessions' => $count]);

        return $count;
    }

    /** Revoke all sessions except the one bearing $keepTokenId. */
    public function logoutOthers(User $user, ?int $keepTokenId): int
    {
        $count = 0;
        foreach ($this->activeSessions($user) as $session) {
            if ($session->token_id !== null && $session->token_id === $keepTokenId) {
                continue;
            }
            $this->revoke($session);
            $count++;
        }
        if ($keepTokenId !== null) {
            $user->tokens()->where('id', '!=', $keepTokenId)->delete();
        }
        $this->audit->log('logout_others', $user, [], ['sessions' => $count]);

        return $count;
    }

    private function browser(?string $ua): ?string
    {
        if ($ua === null) {
            return null;
        }

        return match (true) {
            str_contains($ua, 'Edg') => 'Edge',
            str_contains($ua, 'Chrome') => 'Chrome',
            str_contains($ua, 'Firefox') => 'Firefox',
            str_contains($ua, 'Safari') => 'Safari',
            default => 'Unknown',
        };
    }

    private function platform(?string $ua): ?string
    {
        if ($ua === null) {
            return null;
        }

        return match (true) {
            str_contains($ua, 'Windows') => 'Windows',
            str_contains($ua, 'Mac OS') => 'macOS',
            str_contains($ua, 'Android') => 'Android',
            str_contains($ua, 'iPhone'), str_contains($ua, 'iPad') => 'iOS',
            str_contains($ua, 'Linux') => 'Linux',
            default => 'Unknown',
        };
    }
}
