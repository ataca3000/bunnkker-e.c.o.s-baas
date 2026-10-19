<?php

declare(strict_types=1);

namespace Modules\Logistics\Automation\Domain\Services;

use Modules\Logistics\Automation\Domain\Policies\AutomationPolicyRegistry;
use Modules\Logistics\Automation\Domain\ValueObjects\AutomationAction;
use Modules\Logistics\Automation\Domain\ValueObjects\AutomationEvent;

/**
 * Matches an event against the declared policies and returns the notifications
 * to raise.
 *
 * Pure function over the policy registry: no IO, no state, no side effects. It
 * decides WHAT should be notified; the automation engine is what actually
 * dispatches those notifications.
 */
class RuleEngine
{
    public function __construct(
        private readonly AutomationPolicyRegistry $policies,
    ) {}

    /**
     * @return list<AutomationAction>
     */
    public function evaluate(AutomationEvent $event): array
    {
        $actions = [];

        foreach ($this->policies->forEvent($event->name) as $policy) {
            if ($policy->matches($event)) {
                $actions[] = $policy->actionFor($event);
            }
        }

        return $actions;
    }
}
