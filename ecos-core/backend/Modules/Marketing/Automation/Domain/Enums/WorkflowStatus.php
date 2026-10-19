<?php

declare(strict_types=1);

namespace Modules\Marketing\Automation\Domain\Enums;

enum WorkflowStatus: string
{
    case DRAFT = 'draft';
    case PENDING_APPROVAL = 'pending_approval';
    case APPROVED = 'approved';
    case ACTIVE = 'active';
    case PAUSED = 'paused';
    case ARCHIVED = 'archived';
    case FAILED = 'failed';

    public function isEditable(): bool
    {
        return in_array($this, [self::DRAFT, self::PAUSED], true);
    }

    public function canActivate(): bool
    {
        return in_array($this, [self::APPROVED, self::PAUSED], true);
    }

    public function canPause(): bool
    {
        return $this === self::ACTIVE;
    }

    public function canArchive(): bool
    {
        return in_array($this, [self::DRAFT, self::PAUSED, self::FAILED], true);
    }

    public function isLive(): bool
    {
        return $this === self::ACTIVE;
    }
}
