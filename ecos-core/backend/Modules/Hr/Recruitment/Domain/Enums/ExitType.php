<?php

declare(strict_types=1);

namespace Modules\Hr\Recruitment\Domain\Enums;

/**
 * Why someone is leaving.
 *
 * The distinction is not cosmetic: it decides which lifecycle event the exit
 * writes, and it is what "voluntary turnover" counts. Rolling resignation and
 * termination together would make the retention figure meaningless.
 */
enum ExitType: string
{
    case Resignation = 'resignation';
    case Termination = 'termination';
    case Retirement = 'retirement';

    /** Did the person choose to leave? */
    public function isVoluntary(): bool
    {
        return $this !== self::Termination;
    }

    /**
     * The lifecycle event this exit records on completion.
     *
     * Named as a string so the mapping is stated in one place; the exit service
     * resolves it through LifecycleEventType, which owns those values.
     */
    public function lifecycleEventType(): string
    {
        return match ($this) {
            self::Resignation => 'resigned',
            self::Termination => 'terminated',
            self::Retirement => 'retired',
        };
    }

    /** The employee status once the exit completes. */
    public function employeeStatus(): string
    {
        return match ($this) {
            self::Resignation => 'resigned',
            self::Termination, self::Retirement => 'terminated',
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::Resignation => 'Resignation',
            self::Termination => 'Termination',
            self::Retirement => 'Retirement',
        };
    }
}
