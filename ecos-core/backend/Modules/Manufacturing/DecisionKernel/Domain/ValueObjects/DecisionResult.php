<?php

declare(strict_types=1);

namespace Modules\Manufacturing\DecisionKernel\Domain\ValueObjects;

use Modules\Manufacturing\DecisionKernel\Domain\Enums\DecisionType;

/**
 * Immutable output of the Decision Kernel.
 *
 * All callers (Manufacturing Engine, Cost Engine, AI Engine, CLI, API) receive
 * this single contract. They act on `decision` and read `reason` for logging.
 *
 * Snapshot fields (Phase 6 — architecture only):
 *   `snapshot_id`   — future: UUID of the persisted decision snapshot.
 *   `snapshot_hash` — future: SHA-256 of the full decision payload for integrity checks.
 * Both default to null. No snapshot logic is implemented here.
 */
final readonly class DecisionResult
{
    /**
     * @param  array<string, mixed>  $metadata
     */
    public function __construct(
        public DecisionType $decision,
        public DecisionReason $reason,

        /** The evaluation that won (highest priority matching rule). */
        public DecisionEvaluation $matched_rule,

        /** The context passed into this evaluation cycle. */
        public DecisionContext $context,

        /** The trigger that initiated this evaluation cycle. */
        public DecisionTrigger $trigger,

        /** ISO 8601 timestamp of when the kernel produced this result. */
        public string $decided_at,

        public array $metadata = [],

        // ── Phase 6 — Snapshot Support (architecture placeholder) ─────────────
        public ?string $snapshot_id = null,
        public ?string $snapshot_hash = null,
    ) {}

    // ── Convenience helpers ───────────────────────────────────────────────────

    public function isApproved(): bool
    {
        return $this->decision === DecisionType::Approve;
    }

    public function isRejected(): bool
    {
        return $this->decision === DecisionType::Reject;
    }

    public function isDeferred(): bool
    {
        return $this->decision === DecisionType::Defer;
    }

    public function isPartial(): bool
    {
        return $this->decision === DecisionType::Partial;
    }

    public function isEscalated(): bool
    {
        return $this->decision === DecisionType::Escalate;
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'decision' => $this->decision->value,
            'reason' => $this->reason->toArray(),
            'matched_rule' => $this->matched_rule->toArray(),
            'context' => $this->context->toArray(),
            'trigger' => $this->trigger->toArray(),
            'decided_at' => $this->decided_at,
            'metadata' => $this->metadata,
            'snapshot_id' => $this->snapshot_id,
            'snapshot_hash' => $this->snapshot_hash,
        ];
    }
}
