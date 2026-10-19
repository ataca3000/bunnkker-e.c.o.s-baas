<?php

declare(strict_types=1);

namespace Modules\Crm\Intelligence\Domain\Enums;

/** The tone/urgency of a deterministic customer insight. */
enum InsightSeverity: string
{
    case Info = 'info';
    case Positive = 'positive';
    case Warning = 'warning';
    case Critical = 'critical';

    public function label(): string
    {
        return ucfirst($this->value);
    }
}
