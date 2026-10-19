<?php

declare(strict_types=1);

namespace Modules\Crm\Sales\Domain\Enums;

/**
 * A sales activity on a lead or opportunity — a logged touch (call/email/
 * meeting/note) or a forward-looking one (reminder / follow-up).
 */
enum SalesActivityType: string
{
    case Call = 'call';
    case Email = 'email';
    case Meeting = 'meeting';
    case Note = 'note';
    case Reminder = 'reminder';
    case FollowUp = 'follow_up';

    public function isScheduled(): bool
    {
        return $this === self::Reminder || $this === self::FollowUp || $this === self::Meeting;
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_map(static fn (self $c) => $c->value, self::cases());
    }
}
