<?php

declare(strict_types=1);

namespace Modules\Logistics\Carriers\Domain\ValueObjects;

use Modules\Logistics\Delivery\Domain\Enums\DeliveryStatus;
use Modules\Logistics\Delivery\Domain\Enums\FailureReason;

/**
 * A carrier event translated into ECOS vocabulary.
 *
 * ┌─ DIRECTIVE 9 — THE ANTICORRUPTION BOUNDARY ─────────────────────────────┐
 * │ This object speaks ECOS: DeliveryStatus and FailureReason, the enums     │
 * │ LOG-005 already defines. A carrier's "OUT_FOR_DEL", "NDR_CNA" or         │
 * │ "RTO_INITIATED" never travels past its adapter.                          │
 * │                                                                          │
 * │ An UNMAPPABLE status is explicit — isUnmapped() with the raw value       │
 * │ preserved — never coerced to a "closest" match. A wrong status silently  │
 * │ applied to a customer's order is far worse than a visible gap, so the    │
 * │ gap goes to a queue a human works.                                       │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class NormalizedCarrierEvent
{
    private function __construct(
        public readonly string $carrierEventId,
        public readonly string $rawStatus,
        public readonly ?DeliveryStatus $deliveryStatus,
        public readonly ?FailureReason $failureReason,
        public readonly ?string $trackingNumber,
        public readonly ?string $occurredAt,
        public readonly array $metadata = [],
    ) {}

    public static function mapped(
        string $carrierEventId,
        string $rawStatus,
        DeliveryStatus $deliveryStatus,
        ?FailureReason $failureReason = null,
        ?string $trackingNumber = null,
        ?string $occurredAt = null,
        array $metadata = [],
    ): self {
        return new self(
            $carrierEventId,
            $rawStatus,
            $deliveryStatus,
            $failureReason,
            $trackingNumber,
            $occurredAt,
            $metadata,
        );
    }

    /**
     * The carrier sent something we have no mapping for.
     *
     * Recorded and surfaced as an integration gap. Never guessed.
     */
    public static function unmapped(
        string $carrierEventId,
        string $rawStatus,
        ?string $trackingNumber = null,
        ?string $occurredAt = null,
        array $metadata = [],
    ): self {
        return new self(
            $carrierEventId,
            $rawStatus,
            null,
            null,
            $trackingNumber,
            $occurredAt,
            $metadata,
        );
    }

    public function isUnmapped(): bool
    {
        return $this->deliveryStatus === null;
    }

    public function isFailure(): bool
    {
        return $this->failureReason !== null;
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'carrier_event_id' => $this->carrierEventId,
            'raw_status' => $this->rawStatus,
            'delivery_status' => $this->deliveryStatus?->value,
            'failure_reason' => $this->failureReason?->value,
            'tracking_number' => $this->trackingNumber,
            'occurred_at' => $this->occurredAt,
            'is_unmapped' => $this->isUnmapped(),
            'metadata' => $this->metadata,
        ];
    }
}
