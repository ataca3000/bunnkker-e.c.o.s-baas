<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * CR-PREP-001 — Fired when a Preparation Session is closed (terminal state).
 * Signals Loading & Allocation OS that the session is fully archived.
 */
final class PreparationSessionClosed
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly string $sessionId,
        public readonly string $warehouseId,
        public readonly string $companyId,
        public readonly string $closedBy,
        public readonly string $occurredAt,
    ) {}
}
