<?php

declare(strict_types=1);

namespace Modules\Platform\EventPlatform\Domain\ValueObjects;

final class RetryPolicy
{
    private function __construct(private readonly array $delaysInSeconds) {}

    /** Single immediate attempt — no retries. */
    public static function none(): self
    {
        return new self([]);
    }

    /** Retry once immediately. */
    public static function immediate(): self
    {
        return new self([0]);
    }

    /** 4 retries: 5s → 30s → 5min → 1hr */
    public static function standard(): self
    {
        return new self([5, 30, 300, 3600]);
    }

    /** 5 retries: 5s → 30s → 5min → 1hr → 24hr */
    public static function aggressive(): self
    {
        return new self([5, 30, 300, 3600, 86400]);
    }

    /** Custom delay schedule. */
    public static function custom(array $delaysInSeconds): self
    {
        return new self($delaysInSeconds);
    }

    public function getDelays(): array
    {
        return $this->delaysInSeconds;
    }

    /** Maximum total attempts (initial + retries). */
    public function getMaxAttempts(): int
    {
        return count($this->delaysInSeconds) + 1;
    }

    /**
     * Returns the delay in seconds before the given attempt number.
     * Attempt 1 = initial attempt (no delay), attempt 2 = first retry, etc.
     */
    public function getDelayForAttempt(int $attempt): int
    {
        $retryIndex = $attempt - 2;

        return $this->delaysInSeconds[$retryIndex] ?? 0;
    }

    public function shouldRetry(int $currentAttempt): bool
    {
        return $currentAttempt < $this->getMaxAttempts();
    }

    public function toArray(): array
    {
        return ['delays' => $this->delaysInSeconds];
    }

    public static function fromArray(array $data): self
    {
        return new self($data['delays'] ?? []);
    }
}
