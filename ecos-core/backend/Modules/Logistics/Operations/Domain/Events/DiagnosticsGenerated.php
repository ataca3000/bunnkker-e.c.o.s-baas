<?php

declare(strict_types=1);

namespace Modules\Logistics\Operations\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * A diagnostics snapshot was generated.
 *
 * Notification only. Carries the headline system status as an immutable scalar
 * so Observability can record "diagnostics ran, system was X" without re-reading
 * anything.
 */
class DiagnosticsGenerated
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly string $systemStatus,
        public readonly bool $isQuiet,
        public readonly ?string $companyId,
        public readonly string $occurredAt,
    ) {}
}
