<?php

declare(strict_types=1);

namespace Modules\Logistics\Automation\Application\Listeners;

use Modules\Logistics\Automation\Domain\ValueObjects\AutomationEvent;
use Modules\Logistics\Dispatch\Domain\Events\DispatchConflictDetected;

class DispatchConflictDetectedListener extends AbstractAutomationListener
{
    public function handle(DispatchConflictDetected $event): void
    {
        // A blocking conflict is critical to notify; advisory is a warning.
        $severity = $event->severity === 'blocking' ? 'critical' : 'warning';

        $this->process(new AutomationEvent(
            name: $event::class,
            severity: $severity,
            status: null,
            companyId: $event->companyId,
            occurredAt: $event->occurredAt,
            payload: [
                'conflict_uuid' => $event->conflictUuid,
                'conflict_type' => $event->conflictType,
                'authority' => $event->authority,
            ],
        ));
    }
}
