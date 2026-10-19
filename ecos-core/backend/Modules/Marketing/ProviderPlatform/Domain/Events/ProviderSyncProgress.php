<?php

declare(strict_types=1);

namespace Modules\Marketing\ProviderPlatform\Domain\Events;

/** Fired during an active sync to report incremental progress. */
final class ProviderSyncProgress extends AbstractProviderEvent
{
    public function eventName(): string
    {
        return 'provider.sync_progress';
    }
}
