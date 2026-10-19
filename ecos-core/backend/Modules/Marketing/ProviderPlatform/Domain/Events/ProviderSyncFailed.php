<?php

declare(strict_types=1);

namespace Modules\Marketing\ProviderPlatform\Domain\Events;

/**
 * Fired when a provider sync job fails.
 * metadata.error contains the sanitized failure reason (no stack traces or tokens).
 */
final class ProviderSyncFailed extends AbstractProviderEvent
{
    public function eventName(): string
    {
        return 'provider.sync_failed';
    }
}
