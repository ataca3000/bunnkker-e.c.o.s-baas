<?php

declare(strict_types=1);

namespace Modules\Marketing\Assets\Domain\Enums;

enum AssetHealth: string
{
    case Healthy = 'healthy';
    case Warning = 'warning';
    case Disconnected = 'disconnected';
    case ExpiredToken = 'expired_token';
    case PermissionMissing = 'permission_missing';
    case SyncFailed = 'sync_failed';
    case Inactive = 'inactive';
    case Unknown = 'unknown';

    public function label(): string
    {
        return match ($this) {
            self::Healthy => 'Healthy',
            self::Warning => 'Warning',
            self::Disconnected => 'Disconnected',
            self::ExpiredToken => 'Expired Token',
            self::PermissionMissing => 'Permission Missing',
            self::SyncFailed => 'Sync Failed',
            self::Inactive => 'Inactive',
            self::Unknown => 'Unknown',
        };
    }

    public function isHealthy(): bool
    {
        return $this === self::Healthy;
    }

    public function requiresAction(): bool
    {
        return in_array($this, [
            self::Disconnected,
            self::ExpiredToken,
            self::PermissionMissing,
            self::SyncFailed,
        ], true);
    }
}
