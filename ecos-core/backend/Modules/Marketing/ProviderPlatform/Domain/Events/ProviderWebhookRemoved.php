<?php

declare(strict_types=1);

namespace Modules\Marketing\ProviderPlatform\Domain\Events;

/** Fired when a webhook subscription is removed from the provider. */
final class ProviderWebhookRemoved extends AbstractProviderEvent
{
    public function eventName(): string
    {
        return 'provider.webhook_removed';
    }
}
