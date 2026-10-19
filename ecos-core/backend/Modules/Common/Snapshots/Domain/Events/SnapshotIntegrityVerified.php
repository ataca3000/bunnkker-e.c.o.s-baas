<?php

declare(strict_types=1);

namespace Modules\Common\Snapshots\Domain\Events;

/**
 * Fired when a snapshot's SHA-256 hash is re-verified and confirmed intact.
 */
final class SnapshotIntegrityVerified
{
    public function __construct(
        public readonly string $snapshotUuid,
        public readonly string $aggregateType,
        public readonly string $aggregateId,
        public readonly string $verifiedAt,
        public readonly ?string $verifiedBy,
    ) {}
}
