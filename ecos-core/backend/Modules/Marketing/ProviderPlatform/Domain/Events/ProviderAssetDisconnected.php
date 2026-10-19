<?php

declare(strict_types=1);

namespace Modules\Marketing\ProviderPlatform\Domain\Events;

/**
 * Fired when an asset is disconnected (typically via parent business disconnection cascade).
 * Historical data is preserved; asset is no longer synced.
 */
final class ProviderAssetDisconnected extends AbstractProviderEvent
{
    public function eventName(): string
    {
        return 'provider.asset_disconnected';
    }
}
