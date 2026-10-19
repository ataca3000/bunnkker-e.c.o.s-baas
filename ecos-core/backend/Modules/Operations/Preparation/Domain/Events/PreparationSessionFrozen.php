<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * CR-PREP-001 Part 3 — Fired when a Preparation Session is frozen.
 *
 * A frozen session no longer accepts new orders or demand changes.
 * Loading & Allocation OS consumes sessions in this state.
 */
final class PreparationSessionFrozen
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly string $sessionId,
        public readonly string $warehouseId,
        public readonly string $companyId,
        public readonly int $ordersCount,
        public readonly int $productsCount,
        public readonly string $frozenBy,
        public readonly string $occurredAt,
    ) {}
}
