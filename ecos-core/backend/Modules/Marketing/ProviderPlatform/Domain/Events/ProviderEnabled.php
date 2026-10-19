<?php

declare(strict_types=1);

namespace Modules\Marketing\ProviderPlatform\Domain\Events;

/** Fired when a previously disabled provider integration is re-enabled. */
final class ProviderEnabled extends AbstractProviderEvent
{
    public function eventName(): string
    {
        return 'provider.enabled';
    }
}
