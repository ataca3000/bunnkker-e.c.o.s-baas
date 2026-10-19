<?php

declare(strict_types=1);

namespace Modules\Marketing\ProviderPlatform\Domain\Events;

/** Fired when a provider connection is revoked or disconnected. */
final class ProviderDisconnected extends AbstractProviderEvent
{
    public function eventName(): string
    {
        return 'provider.disconnected';
    }
}
