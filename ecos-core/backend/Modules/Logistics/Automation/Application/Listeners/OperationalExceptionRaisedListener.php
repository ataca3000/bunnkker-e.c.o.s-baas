<?php

declare(strict_types=1);

namespace Modules\Logistics\Automation\Application\Listeners;

use Modules\Logistics\Automation\Domain\ValueObjects\AutomationEvent;
use Modules\Logistics\Operations\Domain\Events\OperationalExceptionRaised;

class OperationalExceptionRaisedListener extends AbstractAutomationListener
{
    public function handle(OperationalExceptionRaised $event): void
    {
        // The exception already carries its own severity — used verbatim, never
        // re-judged. This listener only decides who to TELL, not what to do.
        $this->process(new AutomationEvent(
            name: $event::class,
            severity: $event->severity,
            status: null,
            companyId: $event->companyId,
            occurredAt: $event->occurredAt,
            payload: [
                'exception_uuid' => $event->exceptionUuid,
                'source' => $event->source,
                'category' => $event->category,
                'exception_type' => $event->exceptionType,
            ],
        ));
    }
}
