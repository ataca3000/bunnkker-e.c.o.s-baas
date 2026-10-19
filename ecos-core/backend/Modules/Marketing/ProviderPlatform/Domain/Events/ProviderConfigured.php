<?php

declare(strict_types=1);

namespace Modules\Marketing\ProviderPlatform\Domain\Events;

/** Fired when a provider is configured for the first time for a company. */
final class ProviderConfigured extends AbstractProviderEvent
{
    public function eventName(): string
    {
        return 'provider.configured';
    }
}
