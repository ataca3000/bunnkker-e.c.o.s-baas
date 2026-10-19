<?php

declare(strict_types=1);

namespace Modules\Common\Snapshots\Domain\Contracts;

/**
 * Base contract for any aggregate that can be snapshotted.
 * Implement on domain aggregates (Order, POS Sale, Invoice, etc.)
 * before passing them to the SnapshotManager.
 */
interface Snapshotable
{
    /** Primary key of the aggregate being snapshotted. */
    public function getSnapshotAggregateId(): string;

    /** Registered type from SnapshotRegistry (e.g. 'order', 'pos_sale'). */
    public function getSnapshotAggregateType(): string;

    /** Company that owns this aggregate. */
    public function getSnapshotCompanyId(): ?string;
}
