<?php

declare(strict_types=1);

namespace Modules\Common\Snapshots\Domain\Timeline;

/**
 * Produces standardized snapshot lifecycle timeline entries.
 *
 * Every consuming module receives identical timeline behavior.
 * The builder returns event data arrays; persistence is handled by the module's
 * SnapshotPersistenceAdapter::logSnapshotEvent().
 */
final class SnapshotTimelineBuilder
{
    /**
     * @return array{type: string, description: string, metadata: array<string, mixed>}
     */
    public function businessContextCaptured(string $aggregateId, ?string $brandName, ?string $channelName, ?string $priceSource): array
    {
        return [
            'type' => 'business_context_captured',
            'description' => 'Business context snapshot locked at transaction confirmation.',
            'metadata' => [
                'aggregate_id' => $aggregateId,
                'brand_name' => $brandName,
                'channel_name' => $channelName,
                'price_source' => $priceSource,
            ],
        ];
    }

    /**
     * @return array{type: string, description: string, metadata: array<string, mixed>}
     */
    public function financialSnapshotCreated(string $aggregateId, string $snapshotId, string $snapshotUuid, float $grandTotal, string $integrityHash): array
    {
        return [
            'type' => 'financial_snapshot_created',
            'description' => 'Financial snapshot locked at transaction confirmation.',
            'metadata' => [
                'aggregate_id' => $aggregateId,
                'snapshot_id' => $snapshotId,
                'snapshot_uuid' => $snapshotUuid,
                'grand_total' => $grandTotal,
                'integrity_hash' => $integrityHash,
            ],
        ];
    }

    /**
     * @return array{type: string, description: string, metadata: array<string, mixed>}
     */
    public function integrityVerified(string $aggregateId, string $snapshotUuid): array
    {
        return [
            'type' => 'snapshot_integrity_verified',
            'description' => 'SHA-256 integrity hash re-verified — snapshot is intact.',
            'metadata' => [
                'aggregate_id' => $aggregateId,
                'snapshot_uuid' => $snapshotUuid,
            ],
        ];
    }

    /**
     * @return array{type: string, description: string, metadata: array<string, mixed>}
     */
    public function integrityFailed(string $aggregateId, string $snapshotUuid): array
    {
        return [
            'type' => 'snapshot_integrity_failed',
            'description' => 'SHA-256 integrity check FAILED — possible tampering detected.',
            'metadata' => [
                'aggregate_id' => $aggregateId,
                'snapshot_uuid' => $snapshotUuid,
            ],
        ];
    }
}
