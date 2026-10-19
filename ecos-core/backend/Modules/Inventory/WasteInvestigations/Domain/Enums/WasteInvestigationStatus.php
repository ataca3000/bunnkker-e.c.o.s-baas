<?php

declare(strict_types=1);

namespace Modules\Inventory\WasteInvestigations\Domain\Enums;

enum WasteInvestigationStatus: string
{
    case PendingInvestigation = 'pending_investigation';
    case Resolved = 'resolved';

    public function label(): string
    {
        return match ($this) {
            self::PendingInvestigation => 'Pending Investigation',
            self::Resolved => 'Resolved',
        };
    }

    public function isResolved(): bool
    {
        return $this === self::Resolved;
    }
}
