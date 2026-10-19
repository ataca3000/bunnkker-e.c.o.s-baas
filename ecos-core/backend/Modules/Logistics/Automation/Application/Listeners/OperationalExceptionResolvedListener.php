<?php

declare(strict_types=1);

namespace Modules\Logistics\Automation\Application\Listeners;

use Modules\Logistics\Automation\Domain\ValueObjects\AutomationEvent;
use Modules\Logistics\Operations\Domain\Events\OperationalExceptionResolved;

class OperationalExceptionResolvedListener extends AbstractAutomationListener
{
    public function handle(OperationalExceptionResolved $event): void
    {
        $this->process(new AutomationEvent(
            name: $event::class,
            severity: 'info',
            // Distinguishes a human resolution from an auto-resolution.
            status: $event->status,
            companyId: $event->companyId,
            occurredAt: $event->occurredAt,
            payload: [
                'exception_uuid' => $event->exceptionUuid,
                'source' => $event->source,
                'resolution' => $event->resolution,
            ],
        ));
    }
}
