<?php

declare(strict_types=1);

namespace Modules\Logistics\Automation\Application\Listeners;

use Modules\Logistics\Automation\Domain\ValueObjects\AutomationEvent;
use Modules\Logistics\Operations\Domain\Events\ExecutiveSummaryGenerated;

class ExecutiveSummaryGeneratedListener extends AbstractAutomationListener
{
    public function handle(ExecutiveSummaryGenerated $event): void
    {
        $this->process(new AutomationEvent(
            name: $event::class,
            severity: $this->severityForStatus($event->overallStatus),
            status: $event->overallStatus,
            companyId: $event->companyId,
            occurredAt: $event->occurredAt,
            payload: ['health_score' => $event->healthScore, 'grade' => $event->grade],
        ));
    }
}
