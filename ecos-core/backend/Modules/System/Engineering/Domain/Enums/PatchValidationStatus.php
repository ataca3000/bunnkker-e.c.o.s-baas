<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Enums;

/**
 * Lifecycle status of a full patch validation run (TASK-ENG-V2-002 Self-Healing Pipeline).
 */
enum PatchValidationStatus: string
{
    case Pending = 'pending';
    case Running = 'running';
    case Passed = 'passed';
    case Failed = 'failed';
    case Error = 'error';
    case Cancelled = 'cancelled';

    public function isTerminal(): bool
    {
        return match ($this) {
            self::Passed, self::Failed, self::Error, self::Cancelled => true,
            self::Pending, self::Running => false,
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::Pending   => 'Pending',
            self::Running   => 'Running',
            self::Passed    => 'Passed',
            self::Failed    => 'Failed',
            self::Error     => 'Error',
            self::Cancelled => 'Cancelled',
        };
    }
}
