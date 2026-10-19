<?php

declare(strict_types=1);

namespace Modules\Marketing\ProviderPlatform\Domain\Events;

/**
 * Fired when a provider's OAuth access token has expired.
 * Triggers notification to administrators and reconnection workflow.
 */
final class ProviderTokenExpired extends AbstractProviderEvent
{
    public function eventName(): string
    {
        return 'provider.token_expired';
    }
}
