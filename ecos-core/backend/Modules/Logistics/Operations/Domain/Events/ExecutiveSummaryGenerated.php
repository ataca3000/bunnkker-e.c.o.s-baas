<?php

declare(strict_types=1);

namespace Modules\Logistics\Operations\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * An executive logistics summary was generated.
 *
 * Notification only — carries the score and status that the summary already
 * computed. Useful for a scheduled digest or an AI briefing consumer that wants
 * to know a summary was produced and what it said.
 */
class ExecutiveSummaryGenerated
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly int $healthScore,
        public readonly string $grade,
        public readonly string $overallStatus,
        public readonly ?string $companyId,
        public readonly string $occurredAt,
    ) {}
}
