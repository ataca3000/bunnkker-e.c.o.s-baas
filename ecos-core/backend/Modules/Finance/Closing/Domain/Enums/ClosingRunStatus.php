<?php

declare(strict_types=1);

namespace Modules\Finance\Closing\Domain\Enums;

/**
 * The lifecycle of a closing run: draft → validated → closed → finalized. A run
 * may be validated repeatedly (re-evaluating its checklist) until it closes; it
 * closes only when every blocking check passes.
 */
enum ClosingRunStatus: string
{
    case Draft = 'draft';
    case Validated = 'validated';
    case Closed = 'closed';
    case Finalized = 'finalized';

    public function isClosed(): bool
    {
        return $this === self::Closed || $this === self::Finalized;
    }
}
