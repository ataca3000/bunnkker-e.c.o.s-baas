<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Enums;

enum QualityStatus: string
{
    case PendingReview = 'pending_review';
    case Passed = 'passed';
    case Failed = 'failed';

    public function canBeReserved(): bool
    {
        return $this === self::Passed;
    }
}
