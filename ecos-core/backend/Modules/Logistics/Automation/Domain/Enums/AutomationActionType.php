<?php

declare(strict_types=1);

namespace Modules\Logistics\Automation\Domain\Enums;

/**
 * What an automation policy may do in response to an event.
 *
 * ┌─ EVERY ACTION IS A NOTIFICATION OR A RECORD — NEVER A BUSINESS MOVE ─────┐
 * │ Log records the event; Notify tells a human; Alert raises the urgency of │
 * │ that telling; EscalationNotice tells a HIGHER tier. None of them resolve  │
 * │ a conflict, close an exception, allocate a resource or touch capacity —  │
 * │ those stay with the owning modules. Automation observes and informs; it  │
 * │ does not act on the operation.                                           │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
enum AutomationActionType: string
{
    case Log = 'log';
    case Notify = 'notify';
    case Alert = 'alert';
    case EscalationNotice = 'escalation_notice';

    public function label(): string
    {
        return match ($this) {
            self::Log => 'Log',
            self::Notify => 'Notify',
            self::Alert => 'Alert',
            self::EscalationNotice => 'Escalation notice',
        };
    }
}
