<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Enums;

enum AgentStatus: string
{
    case Unregistered = 'unregistered';
    case Registering  = 'registering';
    case Idle         = 'idle';
    case Busy         = 'busy';
    case Paused       = 'paused';
    case Draining     = 'draining';
    case Offline      = 'offline';
    case Terminated   = 'terminated';

    public function label(): string
    {
        return match ($this) {
            self::Unregistered => 'Unregistered',
            self::Registering  => 'Registering',
            self::Idle         => 'Idle',
            self::Busy         => 'Busy',
            self::Paused       => 'Paused',
            self::Draining     => 'Draining',
            self::Offline      => 'Offline',
            self::Terminated   => 'Terminated',
        };
    }

    public function isActive(): bool
    {
        return in_array($this, [self::Idle, self::Busy, self::Paused]);
    }

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
