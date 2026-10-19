<?php

declare(strict_types=1);

namespace Modules\Marketing\ProviderPlatform\Domain\Events;

/** Fired when a webhook subscription is successfully registered with the provider. */
final class ProviderWebhookRegistered extends AbstractProviderEvent
{
    public function eventName(): string
    {
        return 'provider.webhook_registered';
    }
}
