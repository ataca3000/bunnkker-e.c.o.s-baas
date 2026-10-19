<?php

declare(strict_types=1);

namespace Modules\Marketing\ProviderPlatform\Domain\Events;

/** Fired when a provider configuration is permanently removed. */
final class ProviderConfigurationDeleted extends AbstractProviderEvent
{
    public function eventName(): string
    {
        return 'provider.configuration_deleted';
    }
}
