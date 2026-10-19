<?php

declare(strict_types=1);

namespace Modules\Marketing\ProviderPlatform\Domain\Events;

/**
 * Fired when a provider sync job completes successfully.
 * metadata.assets_discovered contains the count of discovered assets.
 */
final class ProviderSyncCompleted extends AbstractProviderEvent
{
    public function eventName(): string
    {
        return 'provider.sync_completed';
    }
}
