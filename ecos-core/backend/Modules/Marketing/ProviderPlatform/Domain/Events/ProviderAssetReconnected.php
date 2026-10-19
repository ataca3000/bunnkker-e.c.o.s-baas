<?php

declare(strict_types=1);

namespace Modules\Marketing\ProviderPlatform\Domain\Events;

/** Fired when a previously non-active asset is seen again during a sync (transitions back to ACTIVE). */
final class ProviderAssetReconnected extends AbstractProviderEvent
{
    public function eventName(): string
    {
        return 'provider.asset_reconnected';
    }
}
