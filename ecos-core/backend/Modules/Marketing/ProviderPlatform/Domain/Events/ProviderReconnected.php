<?php

declare(strict_types=1);

namespace Modules\Marketing\ProviderPlatform\Domain\Events;

/** Fired when a previously expired or disconnected provider is reconnected. */
final class ProviderReconnected extends AbstractProviderEvent
{
    public function eventName(): string
    {
        return 'provider.reconnected';
    }
}
