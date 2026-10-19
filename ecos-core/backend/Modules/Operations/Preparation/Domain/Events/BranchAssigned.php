<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * TASK-BRANCH-ASSIGNMENT-ENGINE-001 — Fired when BranchAssignmentEngine assigns a branch to an order.
 *
 * Downstream listeners may use this to:
 *  - Notify the assigned branch's operations team
 *  - Start route planning pre-computation
 *  - Update delivery ETA estimates
 */
final class BranchAssigned
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly string $orderId,
        public readonly string $branchId,
        public readonly string $warehouseId,
        public readonly ?string $previousBranchId,
        public readonly ?string $previousWarehouseId,
        public readonly string $occurredAt,
    ) {}
}
