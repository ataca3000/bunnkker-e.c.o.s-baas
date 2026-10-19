<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Enums;

enum ExceptionSeverity: string
{
    case Low = 'low';
    case Medium = 'medium';
    case Critical = 'critical';

    public function isCritical(): bool
    {
        return $this === self::Critical;
    }
}
