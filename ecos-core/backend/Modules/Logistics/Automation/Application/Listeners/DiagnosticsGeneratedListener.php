<?php

declare(strict_types=1);

namespace Modules\Logistics\Automation\Application\Listeners;

use Modules\Logistics\Automation\Domain\ValueObjects\AutomationEvent;
use Modules\Logistics\Operations\Domain\Events\DiagnosticsGenerated;

class DiagnosticsGeneratedListener extends AbstractAutomationListener
{
    public function handle(DiagnosticsGenerated $event): void
    {
        $this->process(new AutomationEvent(
            name: $event::class,
            severity: $this->severityForStatus($event->systemStatus),
            status: $event->systemStatus,
            companyId: $event->companyId,
            occurredAt: $event->occurredAt,
            payload: ['is_quiet' => $event->isQuiet],
        ));
    }
}
