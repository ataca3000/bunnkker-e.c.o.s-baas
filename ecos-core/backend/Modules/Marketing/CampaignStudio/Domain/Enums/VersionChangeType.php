<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Domain\Enums;

enum VersionChangeType: string
{
    case INITIAL = 'initial';
    case BUDGET_CHANGE = 'budget_change';
    case AUDIENCE_CHANGE = 'audience_change';
    case CREATIVE_CHANGE = 'creative_change';
    case PLACEMENT_CHANGE = 'placement_change';
    case SCHEDULE_CHANGE = 'schedule_change';
    case BUSINESS_CONTEXT_CHANGE = 'business_context_change';
    case APPROVAL_DECISION = 'approval_decision';
    case PUBLISHED = 'published';
    case PAUSED = 'paused';
    case RESUMED = 'resumed';
    case SETTINGS_CHANGE = 'settings_change';

    public function label(): string
    {
        return match ($this) {
            self::INITIAL => 'Initial Draft',
            self::BUDGET_CHANGE => 'Budget Changed',
            self::AUDIENCE_CHANGE => 'Audience Changed',
            self::CREATIVE_CHANGE => 'Creative Changed',
            self::PLACEMENT_CHANGE => 'Placements Changed',
            self::SCHEDULE_CHANGE => 'Schedule Changed',
            self::BUSINESS_CONTEXT_CHANGE => 'Business Context Changed',
            self::APPROVAL_DECISION => 'Approval Decision',
            self::PUBLISHED => 'Published',
            self::PAUSED => 'Paused',
            self::RESUMED => 'Resumed',
            self::SETTINGS_CHANGE => 'Campaign Settings Changed',
        };
    }
}
