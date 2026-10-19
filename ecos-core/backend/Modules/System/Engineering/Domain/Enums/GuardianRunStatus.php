<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Enums;

/**
 * Lifecycle status of a Guardian run (TASK-ENG-V2-003 Autonomous Engineering Guardian).
 */
enum GuardianRunStatus: string
{
    case Pending        = 'pending';
    case RunningChecks  = 'running_checks';
    case AwaitingRepair = 'awaiting_repair';
    case Revalidating   = 'revalidating';
    case Passed         = 'passed';
    case Failed         = 'failed';
    case Error          = 'error';
    case Cancelled      = 'cancelled';

    public function isTerminal(): bool
    {
        return match ($this) {
            self::Passed, self::Failed, self::Error, self::Cancelled => true,
            self::Pending, self::RunningChecks, self::AwaitingRepair, self::Revalidating => false,
        };
    }

    public function isActive(): bool
    {
        return ! $this->isTerminal();
    }

    public function label(): string
    {
        return match ($this) {
            self::Pending        => 'Pending',
            self::RunningChecks  => 'Running Checks',
            self::AwaitingRepair => 'Awaiting Repair',
            self::Revalidating   => 'Revalidating',
            self::Passed         => 'Passed',
            self::Failed         => 'Failed',
            self::Error          => 'Error',
            self::Cancelled      => 'Cancelled',
        };
    }
}
