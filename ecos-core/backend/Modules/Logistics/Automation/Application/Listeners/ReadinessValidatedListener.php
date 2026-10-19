<?php

declare(strict_types=1);

namespace Modules\Logistics\Automation\Application\Listeners;

use Modules\Logistics\Automation\Domain\ValueObjects\AutomationEvent;
use Modules\Logistics\Operations\Domain\Events\ReadinessValidated;

class ReadinessValidatedListener extends AbstractAutomationListener
{
    public function handle(ReadinessValidated $event): void
    {
        $this->process(new AutomationEvent(
            name: $event::class,
            severity: $this->severityForStatus($event->overallStatus),
            status: $event->overallStatus,
            companyId: $event->companyId,
            occurredAt: $event->occurredAt,
            payload: [
                'ready' => $event->readyCount,
                'degraded' => $event->degradedCount,
                'not_ready' => $event->notReadyCount,
            ],
        ));
    }
}
