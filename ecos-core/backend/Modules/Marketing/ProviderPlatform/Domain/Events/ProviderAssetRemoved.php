<?php

declare(strict_types=1);

namespace Modules\Marketing\ProviderPlatform\Domain\Events;

/**
 * Fired when an asset is detected as removed from the provider (REMOVED_FROM_PROVIDER).
 * ECOS preserves the historical record; the asset is not deleted.
 */
final class ProviderAssetRemoved extends AbstractProviderEvent
{
    public function eventName(): string
    {
        return 'provider.asset_removed';
    }
}
