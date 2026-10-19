<?php

declare(strict_types=1);

namespace Modules\Common\Snapshots\Domain\Events;

/**
 * Platform event fired when a financial snapshot is fully persisted and locked.
 *
 * Accounting OS listens to SnapshotLocked (not SnapshotCreated) to begin
 * journal entry creation, since Locked guarantees both header and lines are written.
 */
final class SnapshotLocked
{
    public function __construct(
        public readonly string $snapshotUuid,
        public readonly string $aggregateType,
        public readonly string $aggregateId,
        public readonly ?string $companyId,
        public readonly float $grandTotal,
        public readonly ?float $grossProfit,
        public readonly ?float $actualMarginPercent,
        public readonly ?string $marginStatus,
        public readonly string $integrityHash,
        public readonly string $lockedAt,
    ) {}
}
