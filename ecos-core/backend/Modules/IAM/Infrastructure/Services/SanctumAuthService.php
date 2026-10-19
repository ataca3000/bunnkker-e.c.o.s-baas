<?php

declare(strict_types=1);

namespace Modules\IAM\Infrastructure\Services;

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\PersonalAccessToken;
use Modules\IAM\Domain\Contracts\AuthServiceInterface;

/**
 * Laravel Sanctum implementation of {@see AuthServiceInterface}.
 *
 * Uses stateless personal access tokens (Bearer) — no session/CSRF required.
 */
final class SanctumAuthService implements AuthServiceInterface
{
    public function attemptCredentials(string $email, string $password): ?User
    {
        /** @var User|null $user */
        $user = User::query()->where('email', $email)->first();

        if ($user === null || ! Hash::check($password, (string) $user->password)) {
            return null;
        }

        return $user;
    }

    public function issueToken(User $user, bool $remember = false): string
    {
        // "Remember me" tokens are long-lived; otherwise expire after a day.
        $expiresAt = $remember ? null : now()->addDay();

        return $user->createToken('auth', ['*'], $expiresAt)->plainTextToken;
    }

    public function revokeCurrentToken(User $user): void
    {
        $token = $user->currentAccessToken();

        if ($token instanceof PersonalAccessToken) {
            $token->delete();
        }
    }
}
