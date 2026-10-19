<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Domain\Enums;

enum PublishingJobStatus: string
{
    case QUEUED = 'queued';
    case PROCESSING = 'processing';
    case COMPLETED = 'completed';
    case FAILED = 'failed';
    case RETRYING = 'retrying';
    case CANCELLED = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::QUEUED => 'Queued',
            self::PROCESSING => 'Processing',
            self::COMPLETED => 'Completed',
            self::FAILED => 'Failed',
            self::RETRYING => 'Retrying',
            self::CANCELLED => 'Cancelled',
        };
    }

    public function isTerminal(): bool
    {
        return in_array($this, [self::COMPLETED, self::FAILED, self::CANCELLED], true);
    }

    public function canRetry(): bool
    {
        return $this === self::FAILED;
    }
}
