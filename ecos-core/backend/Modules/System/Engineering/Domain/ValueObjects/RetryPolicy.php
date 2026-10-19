<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\ValueObjects;

/** Immutable retry policy for a single pipeline stage. */
final class RetryPolicy
{
    public const BACKOFF_FIXED       = 'fixed';
    public const BACKOFF_LINEAR      = 'linear';
    public const BACKOFF_EXPONENTIAL = 'exponential';

    private function __construct(
        public readonly int    $maxRetries,
        public readonly string $backoffStrategy,
        public readonly int    $retryDelaySeconds,
        public readonly int    $timeoutSeconds,
        /** @var string[] Substrings that mark an error as retryable (empty = all errors) */
        public readonly array  $retryableErrorPatterns,
    ) {}

    public static function noRetry(int $timeoutSeconds = 120): self
    {
        return new self(
            maxRetries:             0,
            backoffStrategy:        self::BACKOFF_FIXED,
            retryDelaySeconds:      0,
            timeoutSeconds:         $timeoutSeconds,
            retryableErrorPatterns: [],
        );
    }

    public static function default(): self
    {
        return new self(
            maxRetries:             2,
            backoffStrategy:        self::BACKOFF_LINEAR,
            retryDelaySeconds:      5,
            timeoutSeconds:         300,
            retryableErrorPatterns: [],
        );
    }

    /** @param array<string, mixed> $data */
    public static function fromArray(array $data): self
    {
        return new self(
            maxRetries:             (int)   ($data['max_retries']              ?? 0),
            backoffStrategy:        (string)($data['backoff_strategy']         ?? self::BACKOFF_FIXED),
            retryDelaySeconds:      (int)   ($data['retry_delay_seconds']      ?? 5),
            timeoutSeconds:         (int)   ($data['timeout_seconds']          ?? 120),
            retryableErrorPatterns: (array) ($data['retryable_error_patterns'] ?? []),
        );
    }

    /** Seconds to wait before retry attempt $retryNumber (1-indexed). */
    public function calculateDelay(int $retryNumber): int
    {
        return match ($this->backoffStrategy) {
            self::BACKOFF_EXPONENTIAL => (int) ($this->retryDelaySeconds * (2 ** ($retryNumber - 1))),
            self::BACKOFF_LINEAR      => $this->retryDelaySeconds * $retryNumber,
            default                   => $this->retryDelaySeconds,
        };
    }

    public function isErrorRetryable(string $errorOutput): bool
    {
        if (empty($this->retryableErrorPatterns)) {
            return true;
        }

        foreach ($this->retryableErrorPatterns as $pattern) {
            if (str_contains($errorOutput, $pattern)) {
                return true;
            }
        }

        return false;
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'max_retries'               => $this->maxRetries,
            'backoff_strategy'          => $this->backoffStrategy,
            'retry_delay_seconds'       => $this->retryDelaySeconds,
            'timeout_seconds'           => $this->timeoutSeconds,
            'retryable_error_patterns'  => $this->retryableErrorPatterns,
        ];
    }
}
