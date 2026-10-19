<?php

declare(strict_types=1);

namespace Modules\Logistics\Automation\Domain\Services;

use Modules\Logistics\Automation\Domain\ValueObjects\AutomationAction;
use Modules\Logistics\Automation\Domain\ValueObjects\AutomationEvent;
use Modules\Logistics\Automation\Infrastructure\Notifications\NotificationDispatcher;
use Modules\Logistics\Automation\Infrastructure\Observability\EventLogger;
use Throwable;

/**
 * The Automation Engine — the single entry point every event consumer calls.
 *
 * ┌─ OBSERVE, DECIDE, NOTIFY — NEVER ACT ON THE OPERATION ──────────────────┐
 * │ handle() logs the event (observability), asks the rule engine which      │
 * │ notifications to raise, and dispatches them. It calls NO operational      │
 * │ service — it never resolves a conflict, closes an exception, allocates a │
 * │ resource or changes capacity. Automation is a notification layer.        │
 * │                                                                          │
 * │ EXCEPTION-SAFE BY CONTRACT: handle() never throws. A notification or     │
 * │ observability failure is recorded and swallowed, so a consumer running   │
 * │ inline can never break the operation that dispatched the event — the     │
 * │ core promise of "events remain notifications only".                      │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
class AutomationEngine
{
    public function __construct(
        private readonly RuleEngine $rules,
        private readonly NotificationDispatcher $notifications,
        private readonly EventLogger $log,
    ) {}

    /**
     * Handle one consumed event: log it, evaluate policies, raise notifications.
     *
     * @return array<string, mixed>  A manifest of what was done (for monitoring
     *                               and tests). Never throws.
     */
    public function handle(AutomationEvent $event): array
    {
        try {
            $this->log->event($event);

            $actions = $this->rules->evaluate($event);

            foreach ($actions as $action) {
                $this->notifications->dispatch($action);
            }

            return [
                'event' => $event->name,
                'logged' => true,
                'actions' => array_map(static fn (AutomationAction $a) => $a->toArray(), $actions),
                'action_count' => count($actions),
            ];
        } catch (Throwable $e) {
            // Recorded, never rethrown — automation must not affect the operation.
            $this->log->failure($event->name, $e->getMessage());

            return ['event' => $event->name, 'logged' => false, 'error' => $e->getMessage()];
        }
    }
}
