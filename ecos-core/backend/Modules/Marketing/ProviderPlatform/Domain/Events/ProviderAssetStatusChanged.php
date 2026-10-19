<?php

declare(strict_types=1);

namespace Modules\Marketing\ProviderPlatform\Domain\Events;

/** Fired when an asset transitions to any new lifecycle status. */
final class ProviderAssetStatusChanged extends AbstractProviderEvent
{
    public function eventName(): string
    {
        return 'provider.asset_status_changed';
    }
}
