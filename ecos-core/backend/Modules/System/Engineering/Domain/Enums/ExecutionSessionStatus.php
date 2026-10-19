<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Enums;

enum ExecutionSessionStatus: string
{
    case Initializing = 'initializing';
    case Running      = 'running';
    case Paused       = 'paused';
    case Completing   = 'completing';
    case Completed    = 'completed';
    case Failed       = 'failed';
    case Aborted      = 'aborted';

    public function label(): string
    {
        return match ($this) {
            self::Initializing => 'Initializing',
            self::Running      => 'Running',
            self::Paused       => 'Paused',
            self::Completing   => 'Completing',
            self::Completed    => 'Completed',
            self::Failed       => 'Failed',
            self::Aborted      => 'Aborted',
        };
    }

    public function isTerminal(): bool
    {
        return in_array($this, [self::Completed, self::Failed, self::Aborted]);
    }

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
