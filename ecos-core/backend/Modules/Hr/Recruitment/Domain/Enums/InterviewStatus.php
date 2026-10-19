<?php

declare(strict_types=1);

namespace Modules\Hr\Recruitment\Domain\Enums;

/** Whether an interview is still ahead, has happened, or fell through. */
enum InterviewStatus: string
{
    case Scheduled = 'scheduled';
    case Completed = 'completed';
    case Cancelled = 'cancelled';
    case NoShow = 'no_show';

    public function isUpcoming(): bool
    {
        return $this === self::Scheduled;
    }

    /** Only a completed interview can carry a decision. */
    public function canRecordDecision(): bool
    {
        return $this === self::Completed;
    }

    public function label(): string
    {
        return match ($this) {
            self::Scheduled => 'Scheduled',
            self::Completed => 'Completed',
            self::Cancelled => 'Cancelled',
            self::NoShow => 'No Show',
        };
    }
}
