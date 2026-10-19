<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Domain\Enums;

enum CampaignInternalStatus: string
{
    case DRAFT = 'draft';
    case PENDING_REVIEW = 'pending_review';
    case APPROVED = 'approved';
    case SCHEDULED = 'scheduled';
    case PUBLISHING = 'publishing';
    case PUBLISHED = 'published';
    case PAUSED = 'paused';
    case ARCHIVED = 'archived';
    case FAILED = 'failed';
    case REJECTED = 'rejected';

    public function label(): string
    {
        return match ($this) {
            self::DRAFT => 'Draft',
            self::PENDING_REVIEW => 'Pending Review',
            self::APPROVED => 'Approved',
            self::SCHEDULED => 'Scheduled',
            self::PUBLISHING => 'Publishing',
            self::PUBLISHED => 'Published',
            self::PAUSED => 'Paused',
            self::ARCHIVED => 'Archived',
            self::FAILED => 'Failed',
            self::REJECTED => 'Rejected',
        };
    }

    public function color(): string
    {
        return match ($this) {
            self::DRAFT => 'gray',
            self::PENDING_REVIEW => 'yellow',
            self::APPROVED => 'blue',
            self::SCHEDULED => 'purple',
            self::PUBLISHING => 'orange',
            self::PUBLISHED => 'green',
            self::PAUSED => 'amber',
            self::ARCHIVED => 'slate',
            self::FAILED => 'red',
            self::REJECTED => 'rose',
        };
    }

    public function isEditable(): bool
    {
        return in_array($this, [self::DRAFT, self::REJECTED], true);
    }

    public function canSubmitForApproval(): bool
    {
        return in_array($this, [self::DRAFT, self::REJECTED], true);
    }

    public function canPublish(): bool
    {
        return in_array($this, [self::APPROVED, self::SCHEDULED], true);
    }
}
