<?php

declare(strict_types=1);

namespace Modules\Marketing\Automation\Domain\Enums;

enum WorkflowTriggerType: string
{
    case BUSINESS_EVENT = 'business_event';
    case SCHEDULE = 'schedule';
    case DATE_BASED = 'date_based';
    case WEBHOOK = 'webhook';
    case API = 'api';
    case MANUAL = 'manual';

    public function requiresEventSubscription(): bool
    {
        return $this === self::BUSINESS_EVENT;
    }

    public function requiresCronSchedule(): bool
    {
        return in_array($this, [self::SCHEDULE, self::DATE_BASED], true);
    }

    public function label(): string
    {
        return match ($this) {
            self::BUSINESS_EVENT => 'Business Event',
            self::SCHEDULE => 'Schedule (Cron)',
            self::DATE_BASED => 'Date / Anniversary',
            self::WEBHOOK => 'Webhook',
            self::API => 'API Trigger',
            self::MANUAL => 'Manual',
        };
    }
}
