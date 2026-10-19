<?php

declare(strict_types=1);

namespace Modules\Marketing\ProviderPlatform\Domain\Events;

/**
 * Fired when the health monitor detects a status transition.
 * metadata.checks contains the boolean check results.
 */
final class ProviderHealthChanged extends AbstractProviderEvent
{
    public function eventName(): string
    {
        return 'provider.health_changed';
    }
}
