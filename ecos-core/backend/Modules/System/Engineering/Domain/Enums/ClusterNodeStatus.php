<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Enums;

enum ClusterNodeStatus: string
{
    case Active   = 'active';
    case Draining = 'draining';
    case Offline  = 'offline';

    public function label(): string
    {
        return match($this) {
            self::Active   => 'Active',
            self::Draining => 'Draining',
            self::Offline  => 'Offline',
        };
    }

    public function isHealthy(): bool
    {
        return $this === self::Active;
    }
}
