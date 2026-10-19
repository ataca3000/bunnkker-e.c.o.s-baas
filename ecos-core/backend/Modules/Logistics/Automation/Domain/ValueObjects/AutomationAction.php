<?php

declare(strict_types=1);

namespace Modules\Logistics\Automation\Domain\ValueObjects;

use Modules\Logistics\Automation\Domain\Enums\AutomationActionType;

/**
 * A single thing the automation layer decided to do about an event — always a
 * notification or a log line, never an operational change.
 *
 * Immutable. Carries the channel it goes out on and who it is for, so a real
 * delivery channel (mail, Slack, webhook) can be added behind the dispatcher
 * without changing this contract.
 */
final class AutomationAction
{
    public function __construct(
        public readonly AutomationActionType $type,
        public readonly string $channel,
        public readonly string $target,
        public readonly string $message,
        public readonly string $policy,
    ) {}

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'type' => $this->type->value,
            'channel' => $this->channel,
            'target' => $this->target,
            'message' => $this->message,
            'policy' => $this->policy,
        ];
    }
}
