<?php

declare(strict_types=1);

namespace Modules\Common\Snapshots\Domain\Events;

/**
 * Fired when a snapshot's SHA-256 hash does not match the stored value,
 * indicating possible DB-level tampering or data corruption.
 */
final class SnapshotVerificationFailed
{
    public function __construct(
        public readonly string $snapshotUuid,
        public readonly string $aggregateType,
        public readonly string $aggregateId,
        public readonly string $detectedAt,
        public readonly ?string $detectedBy,
    ) {}
}
