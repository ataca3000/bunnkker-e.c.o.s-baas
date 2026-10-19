<?php

declare(strict_types=1);

namespace Modules\Finance\Controls\Domain\Enums;

/**
 * The severity of a financial control finding. Weight drives the close-readiness
 * score: a critical finding costs far more than an informational one, and a
 * critical open exception blocks a close outright.
 */
enum ControlSeverity: string
{
    case Info = 'info';
    case Warning = 'warning';
    case Critical = 'critical';

    public function weight(): int
    {
        return match ($this) {
            self::Info => 1,
            self::Warning => 5,
            self::Critical => 20,
        };
    }

    public function isBlocking(): bool
    {
        return $this === self::Critical;
    }
}
