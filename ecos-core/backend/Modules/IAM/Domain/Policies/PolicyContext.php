<?php

declare(strict_types=1);

namespace Modules\IAM\Domain\Policies;

use App\Models\User;

/**
 * PolicyContext — the immutable input a business rule evaluates
 * (TASK-IAM-002 / ADR-038, Part 4).
 *
 * Policies are NOT permissions: they evaluate business state ("is the period
 * balanced?", "is the order inside the cancellation window?"). The context carries
 * the actor, the action, the subject, and an arbitrary attribute bag (time, status,
 * configuration, and — later — AI signals).
 */
final class PolicyContext
{
    /**
     * @param  array<string, mixed>  $attributes
     */
    private function __construct(
        public readonly User $user,
        public readonly string $action,
        public readonly mixed $subject,
        public readonly array $attributes,
    ) {
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    public static function for(User $user, string $action, mixed $subject = null, array $attributes = []): self
    {
        return new self($user, $action, $subject, $attributes);
    }

    public function attribute(string $key, mixed $default = null): mixed
    {
        return $this->attributes[$key] ?? $default;
    }

    public function has(string $key): bool
    {
        return array_key_exists($key, $this->attributes);
    }
}
