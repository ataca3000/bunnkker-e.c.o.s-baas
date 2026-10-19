<?php

declare(strict_types=1);

namespace Modules\Logistics\Dispatch\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * A dispatch conflict was closed — resolved, or overridden with a reason.
 *
 * Notification only. The `resolution` records how it was closed (reassigned,
 * resource freed, condition cleared, overridden, …) as an immutable scalar, so
 * a consumer can distinguish a clean resolution from a deliberate override
 * without inspecting anything further.
 */
class DispatchConflictResolved
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly string $conflictUuid,
        public readonly string $conflictType,
        public readonly string $authority,
        public readonly string $resolution,
        public readonly ?string $companyId,
        public readonly string $occurredAt,
    ) {}
}
