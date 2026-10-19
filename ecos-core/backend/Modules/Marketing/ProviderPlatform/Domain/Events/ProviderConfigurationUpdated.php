<?php

declare(strict_types=1);

namespace Modules\Marketing\ProviderPlatform\Domain\Events;

/** Fired when an existing provider configuration is updated (e.g. new App ID). */
final class ProviderConfigurationUpdated extends AbstractProviderEvent
{
    public function eventName(): string
    {
        return 'provider.configuration_updated';
    }
}
