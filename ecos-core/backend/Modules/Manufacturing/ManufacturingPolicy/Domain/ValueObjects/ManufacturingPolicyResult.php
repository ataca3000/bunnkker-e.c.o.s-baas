<?php

declare(strict_types=1);

namespace Modules\Manufacturing\ManufacturingPolicy\Domain\ValueObjects;

use Modules\Manufacturing\ManufacturingPolicy\Domain\Enums\PolicyCode;

/**
 * Immutable output of ManufacturingPolicy::evaluate().
 *
 * Callers check eligible first:
 *
 *   if ($result->eligible) {
 *       $this->service->manufactureProduct(...);
 *   }
 *
 * Never throw on an ineligible result — all outcomes are typed.
 * The policy_code is machine-readable for programmatic branching.
 * The reason is human-readable for logging and UI display.
 */
final readonly class ManufacturingPolicyResult
{
    /**
     * @param  array<string, mixed>  $metadata
     */
    public function __construct(
        /** True when all policy rules passed. */
        public bool $eligible,

        /** Human-readable explanation (always populated — even for eligible). */
        public string $reason,

        /** Machine-readable typed code. */
        public PolicyCode $policy_code,

        /** Caller metadata + policy context merged together. */
        public array $metadata,
    ) {}

    /**
     * @param  array<string, mixed>  $metadata
     */
    public static function eligible(array $metadata = []): self
    {
        return new self(
            eligible: true,
            reason: PolicyCode::Eligible->label(),
            policy_code: PolicyCode::Eligible,
            metadata: $metadata,
        );
    }

    /**
     * @param  array<string, mixed>  $metadata
     */
    public static function ineligible(
        PolicyCode $code,
        string $reason,
        array $metadata = [],
    ): self {
        return new self(
            eligible: false,
            reason: $reason,
            policy_code: $code,
            metadata: $metadata,
        );
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'eligible' => $this->eligible,
            'reason' => $this->reason,
            'policy_code' => $this->policy_code->value,
            'metadata' => $this->metadata,
        ];
    }
}
