<?php

declare(strict_types=1);

namespace Modules\Logistics\Operations\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * The Logistics Health Score was calculated.
 *
 * Notification only — carries the already-computed score and grade as immutable
 * scalars. It performs no calculation itself; the score was worked out by
 * ReadinessValidationService before this event was ever constructed.
 */
class LogisticsHealthCalculated
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly int $score,
        public readonly string $grade,
        public readonly string $overallStatus,
        public readonly ?string $companyId,
        public readonly string $occurredAt,
    ) {}
}
