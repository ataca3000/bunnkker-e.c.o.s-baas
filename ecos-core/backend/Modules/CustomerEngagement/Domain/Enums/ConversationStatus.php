<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Domain\Enums;

enum ConversationStatus: string
{
    case Open = 'open';
    case Pending = 'pending';
    case WaitingCustomer = 'waiting_customer';
    case WaitingAgent = 'waiting_agent';
    case Resolved = 'resolved';
    case Closed = 'closed';

    public function label(): string
    {
        return match ($this) {
            self::Open => 'Open',
            self::Pending => 'Pending',
            self::WaitingCustomer => 'Waiting Customer',
            self::WaitingAgent => 'Waiting Agent',
            self::Resolved => 'Resolved',
            self::Closed => 'Closed',
        };
    }

    public function isTerminal(): bool
    {
        return in_array($this, [self::Resolved, self::Closed]);
    }
}
