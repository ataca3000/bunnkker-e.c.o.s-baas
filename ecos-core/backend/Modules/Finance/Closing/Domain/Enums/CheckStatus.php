<?php

declare(strict_types=1);

namespace Modules\Finance\Closing\Domain\Enums;

/**
 * The result of a closing-checklist item or a control check.
 */
enum CheckStatus: string
{
    case Pending = 'pending';
    case Passed = 'passed';
    case Failed = 'failed';
    case Skipped = 'skipped';

    public function isPassed(): bool
    {
        return $this === self::Passed;
    }
}
