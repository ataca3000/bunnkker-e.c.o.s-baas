<?php

declare(strict_types=1);

namespace Modules\Commerce\Channels\Domain\Enums;

enum ConnectionStatus: string
{
    case Disconnected = 'disconnected';
    case Connected = 'connected';
    case Error = 'error';

    public function label(): string
    {
        return match ($this) {
            self::Disconnected => 'Disconnected',
            self::Connected => 'Connected',
            self::Error => 'Error',
        };
    }
}
