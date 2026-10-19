<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Enums;

/**
 * Final verdict issued for a validated patch (TASK-ENG-V2-002 Self-Healing Pipeline).
 */
enum ValidationVerdict: string
{
    case Accepted = 'accepted';
    case Rejected = 'rejected';
    case NeedsRevalidation = 'needs_revalidation';

    public function label(): string
    {
        return match ($this) {
            self::Accepted          => 'Accepted',
            self::Rejected          => 'Rejected',
            self::NeedsRevalidation => 'Needs Revalidation',
        };
    }

    public function isFinal(): bool
    {
        return match ($this) {
            self::Accepted, self::Rejected => true,
            self::NeedsRevalidation => false,
        };
    }
}
