<?php

declare(strict_types=1);

namespace Modules\Marketing\ProviderPlatform\Domain\Events;

/** Fired when a provider integration is explicitly disabled by an administrator. */
final class ProviderDisabled extends AbstractProviderEvent
{
    public function eventName(): string
    {
        return 'provider.disabled';
    }
}
