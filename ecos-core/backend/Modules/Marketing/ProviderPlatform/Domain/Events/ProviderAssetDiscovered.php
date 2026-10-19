<?php

declare(strict_types=1);

namespace Modules\Marketing\ProviderPlatform\Domain\Events;

/** Fired when a provider asset is discovered (created or refreshed) during a sync. */
final class ProviderAssetDiscovered extends AbstractProviderEvent
{
    public function eventName(): string
    {
        return 'provider.asset_discovered';
    }
}
