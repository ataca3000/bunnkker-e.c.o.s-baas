<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Domain\Enums;

enum ConversationIntent: string
{
    case LEAD = 'lead';
    case OPPORTUNITY = 'opportunity';
    case QUOTE = 'quote';
    case ORDER = 'order';
    case SUPPORT = 'support';
    case GENERAL = 'general';

    public function label(): string
    {
        return ucfirst($this->value);
    }

    public function isCommercial(): bool
    {
        return in_array($this, [self::LEAD, self::OPPORTUNITY, self::QUOTE, self::ORDER]);
    }
}
