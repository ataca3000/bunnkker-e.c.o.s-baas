<?php

declare(strict_types=1);

namespace Modules\Logistics\Automation\Application\Listeners;

use Modules\Logistics\Automation\Domain\ValueObjects\AutomationEvent;
use Modules\Logistics\Dispatch\Domain\Events\DispatchConflictResolved;

class DispatchConflictResolvedListener extends AbstractAutomationListener
{
    public function handle(DispatchConflictResolved $event): void
    {
        $this->process(new AutomationEvent(
            name: $event::class,
            severity: 'info',
            status: null,
            companyId: $event->companyId,
            occurredAt: $event->occurredAt,
            payload: [
                'conflict_uuid' => $event->conflictUuid,
                'conflict_type' => $event->conflictType,
                'authority' => $event->authority,
                'resolution' => $event->resolution,
            ],
        ));
    }
}
