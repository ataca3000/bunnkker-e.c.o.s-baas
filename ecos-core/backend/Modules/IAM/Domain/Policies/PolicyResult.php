<?php

declare(strict_types=1);

namespace Modules\IAM\Domain\Policies;

/**
 * PolicyResult — the immutable outcome of a policy evaluation (TASK-IAM-002 / ADR-038, Part 4).
 */
final class PolicyResult
{
    private function __construct(
        public readonly bool $allowed,
        public readonly string $reason,
        public readonly ?string $rule,
    ) {
    }

    public static function allow(string $reason = 'policy satisfied', ?string $rule = null): self
    {
        return new self(true, $reason, $rule);
    }

    public static function deny(string $reason, ?string $rule = null): self
    {
        return new self(false, $reason, $rule);
    }

    public function isAllowed(): bool
    {
        return $this->allowed;
    }

    public function isDenied(): bool
    {
        return ! $this->allowed;
    }
}
