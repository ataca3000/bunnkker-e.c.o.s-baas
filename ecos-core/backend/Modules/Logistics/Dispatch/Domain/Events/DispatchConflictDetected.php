<?php

declare(strict_types=1);

namespace Modules\Logistics\Dispatch\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * A dispatch conflict was detected and recorded.
 *
 * Notification only. Carries the conflict's identity, type, severity and the
 * module that OWNS the underlying fact (its authority) as immutable scalars —
 * enough for Observability or Automation to route it, without this event ever
 * re-deriving that judgement (which stays Dispatch's, per the conflict model).
 */
class DispatchConflictDetected
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly string $conflictUuid,
        public readonly string $conflictType,
        public readonly string $severity,
        public readonly string $authority,
        public readonly ?string $companyId,
        public readonly string $occurredAt,
    ) {}
}
