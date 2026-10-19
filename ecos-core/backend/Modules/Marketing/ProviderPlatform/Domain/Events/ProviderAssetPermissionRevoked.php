<?php

declare(strict_types=1);

namespace Modules\Marketing\ProviderPlatform\Domain\Events;

/**
 * Fired when access to an asset is revoked (permissions lost or token scope reduced).
 * Administrators should be notified to re-authorise.
 */
final class ProviderAssetPermissionRevoked extends AbstractProviderEvent
{
    public function eventName(): string
    {
        return 'provider.asset_permission_revoked';
    }
}
