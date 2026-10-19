<?php

declare(strict_types=1);

namespace Modules\Manufacturing\Disassembly\Domain\ValueObjects;

use Modules\Manufacturing\Disassembly\Domain\Enums\DisassemblyPolicyCode;

/**
 * Immutable output of DisassemblyPolicy::evaluate().
 */
final readonly class DisassemblyPolicyResult
{
    /**
     * @param  array<string, mixed>  $metadata
     */
    public function __construct(
        public bool $eligible,
        public string $reason,
        public DisassemblyPolicyCode $policy_code,
        public array $metadata = [],
    ) {}

    /** @param  array<string, mixed>  $metadata */
    public static function eligible(array $metadata = []): self
    {
        return new self(
            eligible: true,
            reason: DisassemblyPolicyCode::Eligible->label(),
            policy_code: DisassemblyPolicyCode::Eligible,
            metadata: $metadata,
        );
    }

    /** @param  array<string, mixed>  $metadata */
    public static function ineligible(
        DisassemblyPolicyCode $code,
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
