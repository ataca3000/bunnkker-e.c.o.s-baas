<?php

declare(strict_types=1);

namespace Modules\Finance\Closing\Domain\Enums;

/**
 * Year-end closing lifecycle: draft (never run) → closed (journals posted,
 * repeatable) → finalized (immutable). A closed year-end may be re-run — which
 * reverses and re-posts — until it is finalized.
 */
enum YearEndStatus: string
{
    case Draft = 'draft';
    case Closed = 'closed';
    case Finalized = 'finalized';

    public function isFinalized(): bool
    {
        return $this === self::Finalized;
    }
}
