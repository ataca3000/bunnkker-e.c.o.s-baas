<?php

declare(strict_types=1);

namespace Modules\Logistics\Automation\Domain\Policies;

use Modules\Logistics\Automation\Domain\Enums\AutomationActionType;
use Modules\Logistics\Automation\Domain\ValueObjects\AutomationAction;
use Modules\Logistics\Automation\Domain\ValueObjects\AutomationEvent;

/**
 * A declarative automation rule: when an event of a given kind meets a
 * condition, produce this notification.
 *
 * ┌─ CONFIGURATION, NOT CODE PATHS ─────────────────────────────────────────┐
 * │ A policy is a pure, immutable value: which event, a severity floor, an   │
 * │ optional status match, and the notification to raise. It NEVER contains  │
 * │ an operational action — the action type is constrained to log / notify / │
 * │ alert / escalation-notice by the enum. Matching is a pure predicate over │
 * │ the event's own scalars; it reads nothing.                               │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class AutomationPolicy
{
    public function __construct(
        public readonly string $name,
        public readonly string $eventName,
        public readonly AutomationActionType $actionType,
        public readonly string $channel,
        public readonly string $target,
        public readonly ?string $minSeverity = null,
        public readonly ?string $statusEquals = null,
        public readonly bool $active = true,
    ) {}

    /** Does this policy fire for the given event? Pure predicate. */
    public function matches(AutomationEvent $event): bool
    {
        if (! $this->active || $event->name !== $this->eventName) {
            return false;
        }

        if ($this->minSeverity !== null && ! $event->severityAtLeast($this->minSeverity)) {
            return false;
        }

        if ($this->statusEquals !== null && $event->status !== $this->statusEquals) {
            return false;
        }

        return true;
    }

    /** The notification this policy raises for a matching event. */
    public function actionFor(AutomationEvent $event): AutomationAction
    {
        return new AutomationAction(
            type: $this->actionType,
            channel: $this->channel,
            target: $this->target,
            message: $this->messageFor($event),
            policy: $this->name,
        );
    }

    private function messageFor(AutomationEvent $event): string
    {
        return sprintf('[%s] %s', strtoupper($event->severity), $this->humanEvent($event->name));
    }

    private function humanEvent(string $name): string
    {
        return trim(preg_replace('/(?<!^)[A-Z]/', ' $0', class_basename($name)) ?? $name);
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'name' => $this->name,
            'event' => class_basename($this->eventName),
            'action' => $this->actionType->value,
            'channel' => $this->channel,
            'target' => $this->target,
            'min_severity' => $this->minSeverity,
            'status_equals' => $this->statusEquals,
            'active' => $this->active,
        ];
    }
}
