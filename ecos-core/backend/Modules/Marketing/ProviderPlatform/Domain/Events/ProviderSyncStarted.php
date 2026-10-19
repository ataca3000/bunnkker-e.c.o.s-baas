<?php

declare(strict_types=1);

namespace Modules\Marketing\ProviderPlatform\Domain\Events;

/** Fired when a sync job starts for a provider connection. */
final class ProviderSyncStarted extends AbstractProviderEvent
{
    public function eventName(): string
    {
        return 'provider.sync_started';
    }
}
