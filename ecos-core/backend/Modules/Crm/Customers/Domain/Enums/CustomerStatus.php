<?php

declare(strict_types=1);

namespace Modules\Crm\Customers\Domain\Enums;

/**
 * The lifecycle state of a customer.
 *
 *   prospect — a lead not yet transacted
 *   active   — a live customer
 *   inactive — dormant, retained
 *   blocked  — barred from transacting
 *   archived — merged away or retired; kept for reference, never deleted
 *
 * The legacy `is_active` flag is derived from this so old code keeps working.
 */
enum CustomerStatus: string
{
    case Prospect = 'prospect';
    case Active = 'active';
    case Inactive = 'inactive';
    case Blocked = 'blocked';
    case Archived = 'archived';

    /** How this status maps to the legacy boolean the master already carries. */
    public function isActiveFlag(): bool
    {
        return $this === self::Active || $this === self::Prospect;
    }

    public function isArchived(): bool
    {
        return $this === self::Archived;
    }

    public function label(): string
    {
        return ucfirst($this->value);
    }
}
