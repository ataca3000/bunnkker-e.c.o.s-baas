<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Domain\Enums;

enum BulkOperationType: string
{
    case PUBLISH = 'publish';
    case PAUSE = 'pause';
    case RESUME = 'resume';
    case ARCHIVE = 'archive';
    case DUPLICATE = 'duplicate';
    case ASSIGN_INITIATIVE = 'assign_initiative';
    case ASSIGN_OWNER = 'assign_owner';
    case ASSIGN_TAGS = 'assign_tags';
    case VALIDATE = 'validate';
    case SCHEDULE = 'schedule';

    public function label(): string
    {
        return match ($this) {
            self::PUBLISH => 'Publish',
            self::PAUSE => 'Pause',
            self::RESUME => 'Resume',
            self::ARCHIVE => 'Archive',
            self::DUPLICATE => 'Duplicate',
            self::ASSIGN_INITIATIVE => 'Assign Initiative',
            self::ASSIGN_OWNER => 'Assign Owner',
            self::ASSIGN_TAGS => 'Assign Tags',
            self::VALIDATE => 'Validate',
            self::SCHEDULE => 'Schedule',
        };
    }

    public function requiresQueue(): bool
    {
        return in_array($this, [self::PUBLISH, self::PAUSE, self::RESUME, self::ARCHIVE, self::DUPLICATE], true);
    }
}
