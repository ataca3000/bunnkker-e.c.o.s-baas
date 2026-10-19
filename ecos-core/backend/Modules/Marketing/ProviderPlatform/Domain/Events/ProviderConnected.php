<?php

declare(strict_types=1);

namespace Modules\Marketing\ProviderPlatform\Domain\Events;

/**
 * Fired when a company successfully completes the OAuth flow and connects to a provider.
 * Never contains access_token or refresh_token — only the connection ID reference.
 */
final class ProviderConnected extends AbstractProviderEvent
{
    public function eventName(): string
    {
        return 'provider.connected';
    }
}
