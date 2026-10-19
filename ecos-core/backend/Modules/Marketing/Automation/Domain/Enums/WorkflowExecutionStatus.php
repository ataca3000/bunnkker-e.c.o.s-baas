<?php

declare(strict_types=1);

namespace Modules\Marketing\Automation\Domain\Enums;

enum WorkflowExecutionStatus: string
{
    case PENDING = 'pending';
    case RUNNING = 'running';
    case COMPLETED = 'completed';
    case FAILED = 'failed';
    case CANCELLED = 'cancelled';
    case TIMED_OUT = 'timed_out';
    case WAITING = 'waiting';

    public function isTerminal(): bool
    {
        return in_array($this, [self::COMPLETED, self::FAILED, self::CANCELLED, self::TIMED_OUT], true);
    }

    public function canRetry(): bool
    {
        return in_array($this, [self::FAILED, self::TIMED_OUT], true);
    }

    public function isActive(): bool
    {
        return in_array($this, [self::PENDING, self::RUNNING, self::WAITING], true);
    }
}
