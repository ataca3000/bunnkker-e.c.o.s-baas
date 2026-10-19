<?php

declare(strict_types=1);

namespace Modules\Crm\Sales\Domain\Enums;

/** An opportunity is open, won or lost. Won/lost are terminal until reopened. */
enum OpportunityStatus: string
{
    case Open = 'open';
    case Won = 'won';
    case Lost = 'lost';

    public function isClosed(): bool
    {
        return $this === self::Won || $this === self::Lost;
    }
}
