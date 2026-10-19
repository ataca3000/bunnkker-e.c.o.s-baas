<?php

declare(strict_types=1);

namespace Modules\Logistics\Automation\Infrastructure\Notifications;

use Illuminate\Support\Facades\Log;
use Modules\Logistics\Automation\Domain\Enums\AutomationActionType;
use Modules\Logistics\Automation\Domain\ValueObjects\AutomationAction;

/**
 * Delivers internal notifications, operational alerts and escalation notices.
 *
 * ┌─ TELLS PEOPLE, CHANGES NOTHING ─────────────────────────────────────────┐
 * │ Delivery here is a structured notification line on the internal channel. │
 * │ It informs a human; it never resolves a conflict, closes an exception or │
 * │ escalates anything in the operational sense — an EscalationNotice is a   │
 * │ MESSAGE to a higher tier, not a call to ExceptionEscalationService.      │
 * │                                                                          │
 * │ A real channel (mail, Slack, webhook) plugs in behind this method        │
 * │ without changing any caller — the AutomationAction already carries the   │
 * │ channel and target.                                                      │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
class NotificationDispatcher
{
    private const TAG = 'logistics.automation';

    public function dispatch(AutomationAction $action): void
    {
        // A pure log action is observability, not a notification.
        if ($action->type === AutomationActionType::Log) {
            Log::info(self::TAG.'.record', $action->toArray());

            return;
        }

        // Notify / Alert / EscalationNotice — routed to a human, at the log
        // level that matches its urgency.
        $level = $action->type === AutomationActionType::Notify ? 'info' : 'warning';

        Log::log($level, self::TAG.'.notification', [
            'kind' => $action->type->value,
            'channel' => $action->channel,
            'target' => $action->target,
            'message' => $action->message,
            'policy' => $action->policy,
        ]);
    }
}
