<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Enums;

enum SessionStatus: string
{
    case Draft = 'draft';
    case Planning = 'planning';    // Supervisor has started planning; waves may be added
    case InProgress = 'in_progress'; // Active preparation underway (≡ Executing)
    case Paused = 'paused';
    case Completed = 'completed';   // All preparation complete; operators done
    case Approved = 'approved';    // Supervisor signed off
    case Frozen = 'frozen';      // CR-PREP-001: Freeze Time reached — no new orders; Loading handoff state
    case Closed = 'closed';      // Terminal: loading confirmed, session archived
    case Cancelled = 'cancelled';   // Terminal: session voided

    public function canTransitionTo(self $next): bool
    {
        return match ($this) {
            self::Draft => in_array($next, [self::Planning, self::InProgress, self::Frozen, self::Cancelled]),
            self::Planning => in_array($next, [self::InProgress, self::Frozen, self::Cancelled]),
            self::InProgress => in_array($next, [self::Paused, self::Completed, self::Frozen, self::Cancelled]),
            self::Paused => in_array($next, [self::InProgress, self::Frozen, self::Cancelled]),
            self::Completed => in_array($next, [self::Approved, self::Frozen]),
            // Frozen → Completed (operators finish remaining work) or Closed (direct Loading handoff)
            self::Frozen => in_array($next, [self::Completed, self::Closed]),
            self::Approved => in_array($next, [self::Closed]),
            self::Closed => false,
            self::Cancelled => false,
        };
    }

    public function isTerminal(): bool
    {
        return $this === self::Closed || $this === self::Cancelled;
    }

    public function isActive(): bool
    {
        return in_array($this, [self::Planning, self::InProgress, self::Paused]);
    }

    /** CR-PREP-001: A frozen session accepts no new orders and no demand changes. */
    public function isFrozen(): bool
    {
        return $this === self::Frozen;
    }

    /** Whether Loading & Allocation OS may consume this session. */
    public function isReadyForLoading(): bool
    {
        return in_array($this, [self::Frozen, self::Completed, self::Approved]);
    }
}
