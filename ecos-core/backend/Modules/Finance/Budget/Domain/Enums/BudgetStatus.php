<?php

declare(strict_types=1);

namespace Modules\Finance\Budget\Domain\Enums;

/**
 * A budget's workflow: draft (editable) → approved (locked, the baseline the
 * control engine measures against) → archived (superseded).
 */
enum BudgetStatus: string
{
    case Draft = 'draft';
    case Approved = 'approved';
    case Archived = 'archived';

    public function isApproved(): bool
    {
        return $this === self::Approved;
    }

    public function isEditable(): bool
    {
        return $this === self::Draft;
    }
}
