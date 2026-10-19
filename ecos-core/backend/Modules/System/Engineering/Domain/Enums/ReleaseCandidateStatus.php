<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Enums;

enum ReleaseCandidateStatus: string
{
    case Draft       = 'draft';
    case UnderReview = 'under_review';
    case Approved    = 'approved';
    case Rejected    = 'rejected';
    case Staged      = 'staged';
    case Released    = 'released';
    case RolledBack  = 'rolled_back';

    public function label(): string
    {
        return match ($this) {
            self::Draft       => 'Draft',
            self::UnderReview => 'Under Review',
            self::Approved    => 'Approved',
            self::Rejected    => 'Rejected',
            self::Staged      => 'Staged',
            self::Released    => 'Released',
            self::RolledBack  => 'Rolled Back',
        };
    }

    public function isTerminal(): bool
    {
        return in_array($this, [self::Released, self::RolledBack]);
    }

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
