<?php

declare(strict_types=1);

namespace Modules\Logistics\Automation\Application\Listeners;

use Modules\Logistics\Automation\Domain\ValueObjects\AutomationEvent;
use Modules\Logistics\Operations\Domain\Events\LogisticsHealthCalculated;

class LogisticsHealthCalculatedListener extends AbstractAutomationListener
{
    public function handle(LogisticsHealthCalculated $event): void
    {
        // A low score is the signal worth notifying on.
        $severity = match (true) {
            $event->score < 40 => 'critical',
            $event->score < 60 => 'warning',
            default => 'info',
        };

        $this->process(new AutomationEvent(
            name: $event::class,
            severity: $severity,
            status: $event->grade,
            companyId: $event->companyId,
            occurredAt: $event->occurredAt,
            payload: ['score' => $event->score, 'grade' => $event->grade, 'overall_status' => $event->overallStatus],
        ));
    }
}
