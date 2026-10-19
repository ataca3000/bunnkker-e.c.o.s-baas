<?php

declare(strict_types=1);

namespace Modules\Common\Snapshots\Domain\Events;

/**
 * Platform event fired when any snapshot is first persisted.
 *
 * AI and BI pipelines subscribe to this event for a single ingestion point
 * across all modules (Orders, POS, Procurement, Manufacturing, etc.).
 */
final class SnapshotCreated
{
    public function __construct(
        public readonly string $snapshotUuid,
        public readonly string $snapshotType,    // 'financial' | 'business_context'
        public readonly string $aggregateType,   // from SnapshotRegistry (e.g. 'order')
        public readonly string $aggregateId,
        public readonly ?string $companyId,
        public readonly ?string $brandId,
        public readonly ?string $channelId,
        public readonly string $timestamp,
        public readonly array $metadata = [],
    ) {}
}
