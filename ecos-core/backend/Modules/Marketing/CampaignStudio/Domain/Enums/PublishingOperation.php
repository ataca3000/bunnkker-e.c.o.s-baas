<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Domain\Enums;

enum PublishingOperation: string
{
    case PUBLISH = 'publish';
    case PAUSE = 'pause';
    case RESUME = 'resume';
    case ARCHIVE = 'archive';
    case DUPLICATE = 'duplicate';
    case UPDATE = 'update';
    case SOFT_DELETE = 'soft_delete';

    public function label(): string
    {
        return match ($this) {
            self::PUBLISH => 'Publish',
            self::PAUSE => 'Pause',
            self::RESUME => 'Resume',
            self::ARCHIVE => 'Archive',
            self::DUPLICATE => 'Duplicate',
            self::UPDATE => 'Update',
            self::SOFT_DELETE => 'Soft Delete (ECOS only)',
        };
    }

    public function requiresProviderCall(): bool
    {
        return $this !== self::SOFT_DELETE;
    }
}
