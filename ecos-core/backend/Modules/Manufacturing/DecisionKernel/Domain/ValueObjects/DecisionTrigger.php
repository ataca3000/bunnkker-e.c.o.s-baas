<?php

declare(strict_types=1);

namespace Modules\Manufacturing\DecisionKernel\Domain\ValueObjects;

use DateTimeImmutable;
use DateTimeInterface;

/**
 * What caused the Decision Kernel to be invoked.
 *
 * Callers:
 *   - Orders module   → type "ORDER_PLACEMENT",    id = order_id
 *   - GR module       → type "GOODS_RECEIPT",      id = gr_id
 *   - Scheduler       → type "SCHEDULE_CHECK",     id = schedule_run_id
 *   - Manufacturing   → type "MFG_REQUEST",        id = mfg_request_id
 *   - AI Engine       → type "AI_RECOMMENDATION",  id = recommendation_id
 *
 * `trigger_version` supports the idempotency constraint from RC-6
 * (`decision_key` = hash of trigger_type + trigger_id + trigger_version).
 */
final readonly class DecisionTrigger
{
    /**
     * @param  array<string, mixed>  $metadata
     */
    public function __construct(
        /** Domain-specific trigger type (e.g. "ORDER_PLACEMENT"). */
        public string $trigger_type,

        /** ID of the entity that triggered the decision (e.g. order UUID). */
        public string $trigger_id,

        /**
         * Monotonically increasing version per (trigger_type, trigger_id) pair.
         * Used to prevent duplicate decision execution (RC-6).
         */
        public int|string $trigger_version,

        /** ISO 8601 timestamp of when the trigger occurred. */
        public string $triggered_at,

        /** Optional actor (user ID, system name) that initiated the trigger. */
        public ?string $actor_id = null,

        public array $metadata = [],
    ) {}

    /** Named constructor — stamps the current time as ISO 8601 (no Laravel facades). */
    public static function now(
        string $type,
        string $id,
        int|string $version = 1,
        ?string $actor = null,
        array $metadata = [],
    ): self {
        return new self(
            trigger_type: $type,
            trigger_id: $id,
            trigger_version: $version,
            triggered_at: (new DateTimeImmutable)->format(DateTimeInterface::ATOM),
            actor_id: $actor,
            metadata: $metadata,
        );
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'trigger_type' => $this->trigger_type,
            'trigger_id' => $this->trigger_id,
            'trigger_version' => $this->trigger_version,
            'triggered_at' => $this->triggered_at,
            'actor_id' => $this->actor_id,
            'metadata' => $this->metadata,
        ];
    }
}
