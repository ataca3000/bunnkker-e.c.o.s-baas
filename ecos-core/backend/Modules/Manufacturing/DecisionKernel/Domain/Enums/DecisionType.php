<?php

declare(strict_types=1);

namespace Modules\Manufacturing\DecisionKernel\Domain\Enums;

/**
 * All possible decisions the Kernel can return.
 *
 * Terminal decisions (Approve, Reject) close the evaluation cycle.
 * Non-terminal decisions (Defer, Partial, Escalate) require further action by the caller.
 */
enum DecisionType: string
{
    /** Proceed with the requested operation in full. */
    case Approve = 'approve';

    /** Block the operation; do not proceed. */
    case Reject = 'reject';

    /** Postpone the operation; re-evaluate later. */
    case Defer = 'defer';

    /** Proceed with a reduced scope (e.g. partial manufacturing). */
    case Partial = 'partial';

    /** Route to a human or higher-level system for a final call. */
    case Escalate = 'escalate';

    public function label(): string
    {
        return match ($this) {
            self::Approve => 'Approved',
            self::Reject => 'Rejected',
            self::Defer => 'Deferred',
            self::Partial => 'Partial Approval',
            self::Escalate => 'Escalated',
        };
    }

    /** True if the decision allows some or all of the operation to proceed. */
    public function isPositive(): bool
    {
        return $this === self::Approve || $this === self::Partial;
    }

    /** True if no further evaluation cycle is needed. */
    public function isTerminal(): bool
    {
        return $this === self::Approve || $this === self::Reject;
    }
}
