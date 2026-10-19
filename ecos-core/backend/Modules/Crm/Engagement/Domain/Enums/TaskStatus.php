<?php

declare(strict_types=1);

namespace Modules\Crm\Engagement\Domain\Enums;

/** The lifecycle of a CRM actionable. */
enum TaskStatus: string
{
    case Open = 'open';
    case Completed = 'completed';
    case Cancelled = 'cancelled';

    public function isOpen(): bool
    {
        return $this === self::Open;
    }
}
