<?php

declare(strict_types=1);

namespace Modules\Marketing\ProviderPlatform\Domain\Events;

/**
 * Fired when provider permissions change (scopes granted or revoked).
 * metadata.granted and metadata.missing contain permission scope lists.
 */
final class ProviderPermissionChanged extends AbstractProviderEvent
{
    public function eventName(): string
    {
        return 'provider.permission_changed';
    }
}
