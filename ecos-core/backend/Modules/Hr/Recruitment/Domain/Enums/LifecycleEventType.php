<?php

declare(strict_types=1);

namespace Modules\Hr\Recruitment\Domain\Enums;

/** The things that happen to someone's employment, in order of their career. */
enum LifecycleEventType: string
{
    case Hired = 'hired';
    case ProbationStarted = 'probation_started';
    case ProbationPassed = 'probation_passed';
    case Confirmed = 'confirmed';
    case Transferred = 'transferred';
    case PositionChanged = 'position_changed';
    case Promoted = 'promoted';
    case Suspended = 'suspended';
    case Reinstated = 'reinstated';
    case Resigned = 'resigned';
    case Terminated = 'terminated';
    // Retiring is not being dismissed. Folding it into Terminated would put a
    // forty-year career and a disciplinary exit under the same word.
    case Retired = 'retired';
    case Rehired = 'rehired';

    /** Events that end the employment relationship. */
    public function isSeparation(): bool
    {
        return in_array($this, [self::Resigned, self::Terminated, self::Retired], true);
    }

    /** Events that start it. */
    public function isEntry(): bool
    {
        return in_array($this, [self::Hired, self::Rehired], true);
    }

    /** Events that move someone without starting or ending anything. */
    public function isMovement(): bool
    {
        return in_array($this, [self::Transferred, self::PositionChanged, self::Promoted], true);
    }

    public function label(): string
    {
        return match ($this) {
            self::Hired => 'Hired',
            self::ProbationStarted => 'Probation Started',
            self::ProbationPassed => 'Probation Passed',
            self::Confirmed => 'Confirmed',
            self::Transferred => 'Department Transfer',
            self::PositionChanged => 'Position Change',
            self::Promoted => 'Promoted',
            self::Suspended => 'Suspended',
            self::Reinstated => 'Reinstated',
            self::Resigned => 'Resigned',
            self::Terminated => 'Terminated',
            self::Retired => 'Retired',
            self::Rehired => 'Rehired',
        };
    }
}
