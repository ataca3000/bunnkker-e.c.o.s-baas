<?php

declare(strict_types=1);

namespace Modules\Marketing\ProviderPlatform\Domain\Events;

/** Fired when provider credentials are validated successfully against the live API. */
final class ProviderValidated extends AbstractProviderEvent
{
    public function eventName(): string
    {
        return 'provider.validated';
    }
}
