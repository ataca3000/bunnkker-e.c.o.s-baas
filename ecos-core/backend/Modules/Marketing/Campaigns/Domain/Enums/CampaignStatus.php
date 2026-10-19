<?php

declare(strict_types=1);

namespace Modules\Marketing\Campaigns\Domain\Enums;

enum CampaignStatus: string
{
    case Active = 'ACTIVE';
    case Paused = 'PAUSED';
    case Deleted = 'DELETED';
    case Archived = 'ARCHIVED';
    case InProcess = 'IN_PROCESS';
    case WithIssues = 'WITH_ISSUES';

    public function label(): string
    {
        return match ($this) {
            self::Active => 'Active',
            self::Paused => 'Paused',
            self::Deleted => 'Deleted',
            self::Archived => 'Archived',
            self::InProcess => 'In Process',
            self::WithIssues => 'With Issues',
        };
    }

    public function isRunning(): bool
    {
        return $this === self::Active;
    }
}
