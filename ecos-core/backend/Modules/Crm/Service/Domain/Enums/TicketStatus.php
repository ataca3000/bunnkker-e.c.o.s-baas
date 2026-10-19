<?php

declare(strict_types=1);

namespace Modules\Crm\Service\Domain\Enums;

/**
 * The resolution workflow of a service case.
 *
 *   new → open → (pending | on_hold) → resolved → closed
 *   resolved/closed → open (reopen);  most states → cancelled
 *
 * The transition map is the workflow — an invalid move is refused by the engine.
 * "Open" states (new/open/pending/on_hold) are what the SLA clock and the
 * escalation engine act on.
 */
enum TicketStatus: string
{
    case New = 'new';
    case Open = 'open';
    case Pending = 'pending';
    case OnHold = 'on_hold';
    case Resolved = 'resolved';
    case Closed = 'closed';
    case Cancelled = 'cancelled';

    /** @return list<self> */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::New => [self::Open, self::Cancelled],
            self::Open => [self::Pending, self::OnHold, self::Resolved, self::Cancelled],
            self::Pending => [self::Open, self::Resolved, self::Cancelled],
            self::OnHold => [self::Open, self::Resolved, self::Cancelled],
            self::Resolved => [self::Closed, self::Open],
            self::Closed => [self::Open],
            self::Cancelled => [],
        };
    }

    public function canTransitionTo(self $target): bool
    {
        return in_array($target, $this->allowedTransitions(), true);
    }

    public function isOpen(): bool
    {
        return in_array($this, [self::New, self::Open, self::Pending, self::OnHold], true);
    }

    /** Only a cancelled case is truly terminal; a closed case can still be reopened. */
    public function isTerminal(): bool
    {
        return $this === self::Cancelled;
    }
}
